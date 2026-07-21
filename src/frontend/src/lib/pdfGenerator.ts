/**
 * Formats and prints an official Al-Amin PolyClinic Medical Document or Prescription
 * as a clean PDF document using the browser's native print engine.
 * Offloads 100% of PDF rendering to the client's browser for zero server CPU/RAM load.
 */

export interface MedicalRecordPdfData {
  patientName?: string
  mrn?: string
  doctorName?: string
  clinicName?: string
  diagnosis?: string
  prescription?: string | null
  notes?: string | null
  date?: string
}

export function exportMedicalRecordPdf(data: MedicalRecordPdfData) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const dateStr = data.date ? new Date(data.date).toLocaleDateString() : new Date().toLocaleDateString()

  const html = `
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
      <head>
        <meta charset="utf-8" />
        <title>Al-Amin PolyClinic Medical Record</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 40px;
            color: #1e293b;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .clinic-title {
            font-size: 24px;
            font-weight: 700;
            color: #0369a1;
          }
          .clinic-sub {
            font-size: 14px;
            color: #64748b;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .meta-item label {
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
          }
          .meta-item p {
            margin: 4px 0 0 0;
            font-size: 15px;
            font-weight: 600;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
            margin-bottom: 10px;
          }
          .content-box {
            font-size: 14px;
            line-height: 1.6;
            white-space: pre-wrap;
            background: #fff;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #f1f5f9;
          }
          .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="clinic-title">Al-Amin PolyClinic</div>
            <div class="clinic-sub">Al-Amin Polyclinic — Official Medical Document</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 600;">Date: ${dateStr}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <label>Patient Name</label>
            <p>${data.patientName || 'Fahad Al-Otaibi'}</p>
          </div>
          <div class="meta-item">
            <label>MRN / File No</label>
            <p>${data.mrn || 'MRN-2026-042'}</p>
          </div>
          <div class="meta-item">
            <label>Attending Doctor</label>
            <p>${data.doctorName || 'Dr. Sarah Al-Fahad'}</p>
          </div>
          <div class="meta-item">
            <label>Department / Clinic</label>
            <p>${data.clinicName || 'General Medicine'}</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Diagnosis & Assessment</div>
          <div class="content-box">${data.diagnosis || 'Routine clinical assessment.'}</div>
        </div>

        ${
          data.prescription
            ? `
        <div class="section">
          <div class="section-title">Prescription & Medications</div>
          <div class="content-box" style="background-color: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: 500;">
            ${data.prescription}
          </div>
        </div>
        `
            : ''
        }

        ${
          data.notes
            ? `
        <div class="section">
          <div class="section-title">Clinical Notes</div>
          <div class="content-box">${data.notes}</div>
        </div>
        `
            : ''
        }

        <div class="footer">
          Confidential Medical Record — Al-Amin PolyClinic, Riyadh, KSA. Generated automatically.
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}
