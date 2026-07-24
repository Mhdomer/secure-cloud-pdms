'use strict';

const CLINICAL_TEMPLATES = [
  // 1. General Medicine
  {
    id: 'tmpl-urti',
    specialty: 'general',
    titleEn: 'Upper Respiratory Infection (URTI)',
    titleAr: 'التهاب الجهاز التنفسي العلوي',
    icd10: 'J06.9',
    chiefComplaintEn: 'Sore throat, nasal congestion, mild dry cough, and low-grade fever for 3 days.',
    chiefComplaintAr: 'ألم في الحلق، احتقان بالأنف، سعال جاف خفيف، وارتفاع خفيف في الحرارة منذ 3 أيام.',
    examinationEn: 'Pharynx erythematous, nasal mucosa congested. Chest clear bilaterally on auscultation. Tonsils non-exudative.',
    examinationAr: 'احمرار في البلعوم، احتقان في الأغشية المخاطية للأنف. الرئتان سليمتان عند التسمع. اللوزتان خالتان من التقيح.',
    diagnosisEn: 'Acute Upper Respiratory Tract Infection (URTI)',
    diagnosisAr: 'التهاب حاد في الجهاز التنفسي العلوي',
    treatmentPlanEn: 'Rest, oral hydration, Paracetamol 500mg TDS PRN, Decongestant nasal spray for 5 days.',
    treatmentPlanAr: 'راحة تامة، زيادة تناول السوائل، باراسيتامول 500 ملغ عند الحاجة، بخاخ أنف لمحي الاحتقان لمدة 5 أيام.',
  },
  {
    id: 'tmpl-gastroenteritis',
    specialty: 'general',
    titleEn: 'Acute Gastroenteritis',
    titleAr: 'التهاب المعدة والأمعاء الحاد',
    icd10: 'A09',
    chiefComplaintEn: 'Abdominal cramps, watery diarrhea (3-4 times/day), and mild nausea.',
    chiefComplaintAr: 'تقلصات وآلام في البطن، إسهال مائي (3-4 مرات يومياً)، وغثيان خفيف.',
    examinationEn: 'Abdomen soft, mild diffuse tenderness on palpation, hyperactive bowel sounds. No signs of severe dehydration.',
    examinationAr: 'البطن لين، ألم خفيف منتشر عند الفحص باللمس، أصوات الأمعاء نشطة. لا توجد علامات جفاف شاديد.',
    diagnosisEn: 'Acute Gastroenteritis (Viral / Dietary)',
    diagnosisAr: 'التهاب حاد في المعدة والأمعاء',
    treatmentPlanEn: 'Oral rehydration solution (ORS), light bland diet (BRAT), Antispasmodic (Hyoscine 10mg) PRN.',
    treatmentPlanAr: 'محلول إرواء الفم (ORS)، حمية خفيفة، مضاد للتقلصات (هيوسين 10 ملغ) عند الحاجة.',
  },
  {
    id: 'tmpl-hypertension',
    specialty: 'general',
    titleEn: 'Essential Hypertension Follow-up',
    titleAr: 'متابعة ضغط الدم المرتفع',
    icd10: 'I10',
    chiefComplaintEn: 'Routine follow-up for essential hypertension. Complains of mild occipital headache.',
    chiefComplaintAr: 'متابعة روتينية لضغط الدم المرتفع. يشكو المريض من صداع خفيف في مؤخرة الرأس.',
    examinationEn: 'BP: 138/86 mmHg, HR: 74 bpm. S1 S2 present, no murmurs. Peripheral pulses palpable.',
    examinationAr: 'ضغط الدم: 138/86 ملم زئبق، النبض: 74 نبضة/دقيقة. أصوات القلب طبيعية، النبض الأطرافي متناسق.',
    diagnosisEn: 'Essential Hypertension (Controlled)',
    diagnosisAr: 'ارتفاع ضغط الدم الأولي (تحت السيطرة)',
    treatmentPlanEn: 'Continue maintenance Antihypertensive therapy (Amlodipine 5mg OD). Low sodium diet and daily walk.',
    treatmentPlanAr: 'الاستمرار على علاج ضغط الدم (أملوديبين 5 ملغ يوماً). تقليل الملح في الطعام وممارسة المشي.',
  },

  // 2. Dental Clinic
  {
    id: 'tmpl-caries',
    specialty: 'dental',
    titleEn: 'Acute Dental Caries & Pulpitis',
    titleAr: 'تسوس الأسنان الحاد والتهاب العصب',
    icd10: 'K02.9',
    chiefComplaintEn: 'Sharp, localized tooth pain triggered by cold and sweet drinks in upper right molar.',
    chiefComplaintAr: 'ألم حاد ومحدد في الضرس العلوي الأيمن يزداد مع المشروبات الباردة والسكريات.',
    examinationEn: 'Deep carious lesion on occlusal surface of tooth #16. Sensitive to cold test and percussion.',
    examinationAr: 'تسوس عميق في السطح الإطباقي للضرس رقم 16. حساسية عند اختبار البرودة والقرع.',
    diagnosisEn: 'Reversible Pulpitis sec to Dental Caries (#16)',
    diagnosisAr: 'التهاب عصب السن الارتجاعي ناتج عن تسوس الضرس (#16)',
    treatmentPlanEn: 'Caries excavation, pulp capping / composite restoration, Ibuprofen 400mg PRN pain.',
    treatmentPlanAr: 'تنظيف التسوس، حشوة حماية العصب وحشوة تجميلية، إيبوبروفين 400 ملغ عند الألم.',
  },

  // 3. Dermatology Clinic
  {
    id: 'tmpl-eczema',
    specialty: 'dermatology',
    titleEn: 'Acute Eczema / Contact Dermatitis',
    titleAr: 'الإكزيما الحادة والتهاب الجلد',
    icd10: 'L30.9',
    chiefComplaintEn: 'Pruritic, red skin rash on forearm flexures for 4 days.',
    chiefComplaintAr: 'حكة شديدة وطفح جلدي أحمر على طيات الساعدين منذ 4 أيام.',
    examinationEn: 'Erythematous papules and mild excoriations present on flexoral surfaces of both arms.',
    examinationAr: 'بقع حمراء مع خدوش خفيفة ناتجة عن الحكة في الذراعين.',
    diagnosisEn: 'Acute Contact Dermatitis / Atopic Eczema',
    diagnosisAr: 'التهاب الجلد التلامسي الحاد / الإكزيما',
    treatmentPlanEn: 'Topical Hydrocortisone 1% cream BD for 7 days, oral Antihistamine (Loratadine 10mg OD), emollient moisturizer.',
    treatmentPlanAr: 'كريم هيدروكورتيزون 1% مرتين يومياً لمدة أسبوع، مضاد للحساسية (لوراتادين 10 ملغ)، مرطب للجلد.',
  },

  // 4. Pediatrics Clinic
  {
    id: 'tmpl-tonsillitis',
    specialty: 'pediatrics',
    titleEn: 'Pediatric Acute Tonsillitis',
    titleAr: 'التهاب اللوزتين والحمى لدى الأطفال',
    icd10: 'J03.9',
    chiefComplaintEn: 'High fever (38.8°C), odynophagia, refusal of solid food for 2 days.',
    chiefComplaintAr: 'حرارة مرتفعة (38.8 مئوية)، صعوبة في البلع، وامتناع عن تناول الطعام الصلب منذ يومين.',
    examinationEn: 'Enlarged, hyperemic tonsils with bilateral white follicular exudates. Tender anterior cervical lymph nodes.',
    examinationAr: 'ضخامة واحمرار في اللوزتين مع وجود نقاط صديدية بيضاء على الجانبين. تضخم العقد اللمفاوية بالعنق.',
    diagnosisEn: 'Acute Follicular Tonsillitis',
    diagnosisAr: 'التهاب اللوزتين الجريبي الحاد',
    treatmentPlanEn: 'Amoxicillin syrup based on weight for 7 days, Paracetamol syrup 120mg/5ml PRN fever.',
    treatmentPlanAr: 'شراب أموكيسيلين حسب الوزن لمدة 7 أيام، شراب باراسيتامول لخفض الحرارة.',
  },
];

exports.listTemplates = async (req, res) => {
  const specialty = req.query.specialty;
  if (specialty) {
    const filtered = CLINICAL_TEMPLATES.filter((t) => t.specialty === specialty || t.specialty === 'general');
    return res.json({ templates: filtered });
  }
  res.json({ templates: CLINICAL_TEMPLATES });
};
