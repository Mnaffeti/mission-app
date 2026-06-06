from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import gradio as gr
from ultralytics import YOLO
import io
import base64
from PIL import Image
import numpy as np
from threading import Thread

flask_app = Flask(__name__)
CORS(flask_app)

# ── Model loading ──────────────────────────────────────────────────────────────
try:
    detection_model = YOLO('best1.pt')
    print("✅ Passport detection model loaded  (best1.pt)")
except Exception as e:
    print(f"❌ best1.pt load error: {e}")
    detection_model = None

try:
    extraction_model = YOLO('mrz_detector.pt')
    print("✅ MRZ extraction model loaded      (mrz_detector.pt)")
except Exception as e:
    print(f"❌ mrz_detector.pt load error: {e}")
    extraction_model = None

try:
    import easyocr
    ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    print("✅ EasyOCR reader initialised")
except Exception as e:
    print(f"⚠️  EasyOCR unavailable: {e}")
    ocr_reader = None

CLASS_NAMES = {0: 'passport', 1: 'photo', 2: 'name', 3: 'surname',
               4: 'date_of_birth', 5: 'mrz', 6: 'number'}

# Mapping des classes à leurs noms de champ OCR
OCR_FIELD_MAPPING = {
    2: 'name',
    3: 'surname', 
    4: 'date_of_birth',
    6: 'passport_number'
}

# ── Helpers ────────────────────────────────────────────────────────────────────
def encode_image(bgr_array):
    pil = Image.fromarray(bgr_array[..., ::-1])
    buf = io.BytesIO()
    pil.save(buf, format='JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def ocr_crop(img_array, box):
    """Crop a region and return OCR text."""
    if ocr_reader is None:
        return ''
    x1, y1, x2, y2 = [int(c) for c in box]
    # add small padding
    h, w = img_array.shape[:2]
    x1, y1 = max(0, x1 - 4), max(0, y1 - 4)
    x2, y2 = min(w, x2 + 4), min(h, y2 + 4)
    crop = img_array[y1:y2, x1:x2]
    if crop.size == 0:
        return ''
    texts = ocr_reader.readtext(crop, detail=0, paragraph=True)
    return ' '.join(texts).strip()


def parse_mrz(raw_text):
    """
    Parse MRZ fields from raw OCR text.
    Cleans the string to MRZ-legal chars (A-Z, 0-9, <) and attempts
    to decode a TD3 (passport) MRZ.
    Returns a dict of decoded fields (empty dict if parsing fails).
    """
    legal = set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<')
    clean = ''.join(c if c in legal else '<' for c in raw_text.upper())

    # split into candidate lines of ~44 chars
    lines = [clean[i:i+44] for i in range(0, len(clean), 44) if len(clean[i:i+44]) >= 30]
    if not lines:
        return {}

    fields = {}

    # Line 1  P<COUNTRYNAME<<GIVEN_NAMES<<<<<<<<<<<<<<<<<
    l1 = lines[0].ljust(44)[:44]
    fields['document_type'] = l1[0]
    fields['issuing_country'] = l1[2:5].replace('<', '')
    name_raw = l1[5:44]
    parts = name_raw.split('<<')
    fields['surname']     = parts[0].replace('<', ' ').strip() if parts else ''
    fields['given_names'] = parts[1].replace('<', ' ').strip() if len(parts) > 1 else ''

    # Line 2  DOC_NUM<CHECK<NAT<DOB<CHECK<SEX<EXP<CHECK<…
    if len(lines) >= 2:
        l2 = lines[1].ljust(44)[:44]
        fields['passport_number'] = l2[0:9].replace('<', '')
        fields['nationality']     = l2[10:13].replace('<', '')
        dob = l2[13:19]
        fields['date_of_birth']   = f"{dob[0:2]}/{dob[2:4]}/{dob[4:6]}" if dob.isdigit() else dob
        fields['sex']             = {'M': 'Male', 'F': 'Female'}.get(l2[20], 'Unknown')
        exp = l2[21:27]
        fields['expiry_date']     = f"{exp[0:2]}/{exp[2:4]}/{exp[4:6]}" if exp.isdigit() else exp

    return fields


# ── Two-stage pipeline ─────────────────────────────────────────────────────────
def run_pipeline(image: Image.Image):
    img_array = np.array(image)

    # ── Stage 1: passport detection ────────────────────────────
    det_results = detection_model(img_array, conf=0.25, verbose=False)

    has_passport  = False
    passport_conf = 0.0
    stage1_dets   = []

    if det_results and len(det_results) > 0:
        for box in det_results[0].boxes:
            cls_id = int(box.cls[0])
            conf   = float(box.conf[0])
            stage1_dets.append({
                'class':      CLASS_NAMES.get(cls_id, f'class_{cls_id}'),
                'confidence': round(conf, 3),
                'bbox':       [round(c, 1) for c in box.xyxy[0].tolist()]
            })
            if cls_id == 0:
                has_passport  = True
                passport_conf = max(passport_conf, conf)

    stage1_img_b64 = encode_image(det_results[0].plot()) if det_results else None

    if not has_passport:
        return {
            'has_passport':      False,
            'message':           'This is not a passport.',
            'confidence':        0.0,
            'stage1_image':      stage1_img_b64,
            'stage1_detections': stage1_dets,
            'ocr_fields':        {},
            'ocr_details':       [],
            'mrz_fields':        {},
            'mrz_raw_text':      '',
            'mrz_detections':    [],
            'mrz_image':         None,
            'person_info':       {},
        }

    # ── Stage 2: OCR des champs détectés (nom, prénom, date, numéro) ──
    ocr_fields = {}
    ocr_details = []
    
    if ocr_reader is not None:
        for det in stage1_dets:
            cls_name = det['class']
            bbox = det['bbox']
            
            # OCR uniquement sur les champs d'intérêt
            if cls_name in ['name', 'surname', 'date_of_birth', 'number']:
                text = ocr_crop(img_array, bbox)
                field_key = 'passport_number' if cls_name == 'number' else cls_name
                
                if text:
                    ocr_fields[field_key] = text
                    ocr_details.append({
                        'field': field_key,
                        'text': text,
                        'confidence': det['confidence'],
                        'bbox': bbox
                    })
    
    # ── Stage 3: MRZ extraction ────────────────────────────────
    mrz_dets     = []
    mrz_img_b64  = None
    mrz_raw_text = ''
    mrz_fields   = {}

    if extraction_model is not None:
        mrz_results = extraction_model(img_array, conf=0.25, verbose=False)
        if mrz_results and len(mrz_results) > 0:
            all_texts = []

            for box in mrz_results[0].boxes:
                cls_id  = int(box.cls[0])
                conf    = float(box.conf[0])
                xyxy    = box.xyxy[0].tolist()

                # OCR the detected region
                text = ocr_crop(img_array, xyxy)
                if text:
                    all_texts.append(text)

                mrz_dets.append({
                    'class':      f'zone_{cls_id}',
                    'confidence': round(conf, 3),
                    'bbox':       [round(c, 1) for c in xyxy],
                    'text':       text,
                })

            mrz_raw_text = ' '.join(all_texts)
            mrz_fields   = parse_mrz(mrz_raw_text)
            mrz_img_b64  = encode_image(mrz_results[0].plot())

    # ── Fusion des résultats: priorité OCR direct > MRZ ──
    final_person_info = {}
    
    # D'abord les champs MRZ comme base
    if mrz_fields:
        final_person_info = {
            'surname': mrz_fields.get('surname', ''),
            'given_names': mrz_fields.get('given_names', ''),
            'passport_number': mrz_fields.get('passport_number', ''),
            'date_of_birth': mrz_fields.get('date_of_birth', ''),
            'nationality': mrz_fields.get('nationality', ''),
            'sex': mrz_fields.get('sex', ''),
            'expiry_date': mrz_fields.get('expiry_date', ''),
            'issuing_country': mrz_fields.get('issuing_country', ''),
        }
    
    # Ensuite les champs OCR directs (plus précis pour les noms)
    if ocr_fields:
        if ocr_fields.get('surname'):
            final_person_info['surname'] = ocr_fields['surname']
        if ocr_fields.get('name'):
            final_person_info['given_names'] = ocr_fields['name']
        if ocr_fields.get('date_of_birth'):
            final_person_info['date_of_birth_visual'] = ocr_fields['date_of_birth']
        if ocr_fields.get('passport_number'):
            final_person_info['passport_number_visual'] = ocr_fields['passport_number']

    return {
        'has_passport':      True,
        'message':           'Passport detected — OCR + MRZ extraction complete.',
        'confidence':        round(passport_conf, 3),
        'stage1_image':      stage1_img_b64,
        'stage1_detections': stage1_dets,
        'ocr_fields':        ocr_fields,
        'ocr_details':       ocr_details,
        'mrz_raw_text':      mrz_raw_text,
        'mrz_fields':        mrz_fields,
        'mrz_detections':    mrz_dets,
        'mrz_image':         mrz_img_b64,
        'person_info':       final_person_info,
    }


# ── Flask routes ───────────────────────────────────────────────────────────────
@flask_app.route('/')
def index():
    return send_from_directory('.', 'telegram_simulator.html')


@flask_app.route('/detect', methods=['POST', 'OPTIONS'])
def detect_passport():
    if request.method == 'OPTIONS':
        return '', 204
    if detection_model is None:
        return jsonify({'error': 'Detection model failed to load'}), 500

    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({'error': 'Send JSON with "image" field (base64)'}), 400

    try:
        image = Image.open(io.BytesIO(base64.b64decode(data['image']))).convert('RGB')
    except Exception as e:
        return jsonify({'error': f'Invalid base64 image: {e}'}), 400

    try:
        return jsonify(run_pipeline(image)), 200
    except Exception as e:
        return jsonify({'error': f'Processing error: {e}'}), 500


@flask_app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':           'ok',
        'detection_model':  detection_model  is not None,
        'extraction_model': extraction_model is not None,
        'ocr':              ocr_reader        is not None,
    }), 200


# ── Gradio UI ──────────────────────────────────────────────────────────────────
def gradio_predict(image):
    if detection_model is None:
        return None, None, "Detection model not loaded."
    result = run_pipeline(image)

    def b64_to_pil(b64):
        return Image.open(io.BytesIO(base64.b64decode(b64))) if b64 else None

    lines = [result['message']]
    if result['has_passport']:
        lines.append(f"Confidence: {result['confidence']:.2%}")
        
        # Informations de la personne (fusion OCR + MRZ)
        if result.get('person_info'):
            lines.append("\n" + "="*40)
            lines.append("👤 INFORMATIONS DE LA PERSONNE")
            lines.append("="*40)
            pi = result['person_info']
            if pi.get('surname'):
                lines.append(f"  Nom:              {pi['surname']}")
            if pi.get('given_names'):
                lines.append(f"  Prénom(s):        {pi['given_names']}")
            if pi.get('passport_number'):
                lines.append(f"  N° Passeport:     {pi['passport_number']}")
            if pi.get('passport_number_visual'):
                lines.append(f"  N° Passeport (visuel): {pi['passport_number_visual']}")
            if pi.get('date_of_birth'):
                lines.append(f"  Date naissance:   {pi['date_of_birth']}")
            if pi.get('date_of_birth_visual'):
                lines.append(f"  Date naissance (visuelle): {pi['date_of_birth_visual']}")
            if pi.get('nationality'):
                lines.append(f"  Nationalité:      {pi['nationality']}")
            if pi.get('sex'):
                lines.append(f"  Sexe:             {pi['sex']}")
            if pi.get('expiry_date'):
                lines.append(f"  Date expiration:  {pi['expiry_date']}")
            if pi.get('issuing_country'):
                lines.append(f"  Pays émetteur:    {pi['issuing_country']}")
        
        # Détails OCR direct
        if result.get('ocr_fields'):
            lines.append("\n" + "-"*40)
            lines.append("📝 OCR DIRECT (zones visuelles)")
            lines.append("-"*40)
            for k, v in result['ocr_fields'].items():
                lines.append(f"  {k.replace('_', ' ').title()}: {v}")
        
        # Champs MRZ
        if result.get('mrz_fields'):
            lines.append("\n" + "-"*40)
            lines.append("🔤 CHAMPS MRZ (zone codée)")
            lines.append("-"*40)
            for k, v in result['mrz_fields'].items():
                lines.append(f"  {k.replace('_', ' ').title()}: {v}")
        
        if result.get('mrz_raw_text'):
            lines.append(f"\n📄 MRZ brut: {result['mrz_raw_text']}")

    return b64_to_pil(result['stage1_image']), b64_to_pil(result['mrz_image']), '\n'.join(lines)


with gr.Blocks(title="Passport Detection") as demo:
    gr.Markdown("# 🛂 Passport Detection + MRZ Extraction")
    with gr.Row():
        with gr.Column():
            img_input  = gr.Image(label="Input Image", type="pil")
            run_btn    = gr.Button("Run", variant="primary")
        with gr.Column():
            out_stage1 = gr.Image(label="Stage 1 – Passport Detection")
        with gr.Column():
            out_mrz    = gr.Image(label="Stage 2 – MRZ Extraction")
    result_box = gr.Textbox(label="Extracted Fields", lines=12, interactive=False)
    run_btn.click(fn=gradio_predict, inputs=img_input,
                  outputs=[out_stage1, out_mrz, result_box])


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    def run_flask():
        flask_app.run(debug=False, host='0.0.0.0', port=5000, use_reloader=False)

    Thread(target=run_flask, daemon=True).start()

    print("\n" + "="*60)
    print("🚀 Passport Detection + MRZ Extraction")
    print("="*60)
    print("🌐 UI:     http://localhost:5000")
    print("📡 API:    http://localhost:5000/detect")
    print("🔬 Gradio: http://localhost:7860")
    print("🏥 Health: http://localhost:5000/health")
    print("="*60 + "\n")

    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)
