# Appendix C — Stakeholder Requirements Validation Correspondence
## LaTeX Figures + Captions + Descriptions

---

### Introductory Paragraph (paste at the start of Appendix C)

This appendix presents the stakeholder requirements validation correspondence conducted between the student, the project supervisor, and Al Amin Polyclinic. The system requirements were initially gathered through direct verbal discussions with clinic staff, including administrative staff, clinic management, and nursing staff. To formally document and validate these requirements, a structured written confirmation process was initiated. A formal request letter was prepared by the project supervisor, Dr Johan Mohamed Sharif, on official UTM Faculty of Computing letterhead, and submitted to the clinic. The clinic subsequently responded with a signed confirmation letter on their official letterhead, verified by the Head Manager and stamped with the clinic's official seal. The complete correspondence — comprising the outgoing email, the clinic's email reply, the supervisor's signed request letter, and the clinic's signed confirmation letter — is presented in Figures C.1 through C.4.

---

### Figure C.1 — Outgoing Email from Student to Clinic

**Caption:**
```
Figure C.1: Email sent by Mohamed Omar Makhlouf to Alamin Medical Clinic on 4 July 2026, attaching the UTM supervisor's formal request letter and requesting written confirmation of the system requirements gathered during stakeholder discussions.
```

**LaTeX code:**
```latex
\begin{figure}[H]
    \centering
    \includegraphics[width=0.88\textwidth]{appendix/C1_email_sent_to_clinic.png}
    \caption{Email sent by Mohamed Omar Makhlouf to Alamin Medical Clinic on 4 July 2026, attaching the UTM supervisor's formal request letter and requesting written confirmation of the system requirements gathered during stakeholder discussions.}
    \label{fig:C1_email_sent}
\end{figure}
```

**Brief description for report body:**
Figure C.1 shows the email sent by the student to Alamin Medical Clinic on 4 July 2026. The email introduces the purpose of the correspondence, references the attached UTM supervisor letter, and requests the clinic to review, sign, and return the enclosed reply letter confirming the system requirements discussed with their staff.

---

### Figure C.2 — Reply Email from Clinic

**Caption:**
```
Figure C.2: Reply email from Omar Zidan of Alamin Medical Clinic, received on 7 July 2026, confirming the clinic's support for the project and attaching the signed requirements confirmation letter (Ref: AMC/FYP/2026/01).
```

**LaTeX code:**
```latex
\begin{figure}[H]
    \centering
    \includegraphics[width=0.88\textwidth]{appendix/C2_email_reply_from_clinic.png}
    \caption{Reply email from Omar Zidan of Alamin Medical Clinic, received on 7 July 2026, confirming the clinic's support for the project and attaching the signed requirements confirmation letter (Ref: AMC/FYP/2026/01).}
    \label{fig:C2_email_reply}
\end{figure}
```

**Brief description for report body:**
Figure C.2 shows the clinic's email reply, received on 7 July 2026 from Omar Zidan of Alamin Medical Clinic. The reply formally confirms the clinic's support for the student's Final Year Project and references the attached signed confirmation letter (Ref: AMC/FYP/2026/01), in which the clinic verifies that the system requirements documented by the student accurately reflect their operational needs.

---

### Figure C.3 — UTM Supervisor's Signed Request Letter

**Caption:**
```
Figure C.3: Official request letter (Ref: UTM.FC/SECRH/FYP.PSM1/2026/01) issued by Dr Johan Mohamed Sharif, Project Supervisor, Faculty of Computing, Universiti Teknologi Malaysia, on 3 July 2026, formally requesting written confirmation of system requirements from Alamin Medical Clinic. Signed by the supervisor and acknowledged with the clinic's official stamp.
```

**LaTeX code:**
```latex
\begin{figure}[H]
    \centering
    \includegraphics[width=0.85\textwidth]{appendix/C3_UTM_supervisor_letter_signed.pdf}
    \caption{Official request letter (Ref: UTM.FC/SECRH/FYP.PSM1/2026/01) issued by Dr Johan Mohamed Sharif, Project Supervisor, Faculty of Computing, Universiti Teknologi Malaysia, on 3 July 2026, formally requesting written confirmation of system requirements from Alamin Medical Clinic. Signed by the supervisor and acknowledged with the clinic's official stamp.}
    \label{fig:C3_utm_letter}
\end{figure}
```

> **Note:** If your LaTeX setup does not support `.pdf` directly in `\includegraphics`, convert to PNG first:
> `\includegraphics[width=0.85\textwidth]{appendix/C3_UTM_supervisor_letter_signed.png}`
> Or use the `pdfpages` package: `\includepdf[pages=-, scale=0.85]{appendix/C3_UTM_supervisor_letter_signed.pdf}`

**Brief description for report body:**
Figure C.3 presents the formal request letter issued on UTM Faculty of Computing official letterhead (Ref: UTM.FC/SECRH/FYP.PSM1/2026/01), dated 3 July 2026. The letter was authored and signed by the project supervisor, Dr Johan Mohamed Sharif, and addressed to the Clinic Manager of Alamin Medical Clinic. It lists the six categories of system requirements gathered from stakeholder discussions and formally requests the clinic's written confirmation that these requirements accurately reflect their operational needs.

---

### Figure C.4 — Al Amin Polyclinic Signed Confirmation Letter

**Caption:**
```
Figure C.4: Official requirements confirmation letter (Ref: AMC/FYP/2026/01) issued by Al Amin Polyclinic on their official letterhead, signed by Ibrahim Shaheel Al Quad (Head Manager) and stamped with the clinic's official seal, confirming that the system requirements documented by the student accurately reflect the operational needs of the clinic.
```

**LaTeX code:**
```latex
\begin{figure}[H]
    \centering
    \includegraphics[width=0.85\textwidth]{appendix/C4_clinic_reply_letter_signed.pdf}
    \caption{Official requirements confirmation letter (Ref: AMC/FYP/2026/01) issued by Al Amin Polyclinic on their official letterhead, signed by Ibrahim Shaheel Al Quad (Head Manager) and stamped with the clinic's official seal, confirming that the system requirements documented by the student accurately reflect the operational needs of the clinic.}
    \label{fig:C4_clinic_letter}
\end{figure}
```

> **Note:** Same note as above — use PNG or `pdfpages` if `.pdf` is not accepted directly.

**Brief description for report body:**
Figure C.4 presents the signed confirmation letter from Al Amin Polyclinic (Ref: AMC/FYP/2026/01), issued on the clinic's official letterhead. The letter was signed by Ibrahim Shaheel Al Quad, Head Manager, and bears the clinic's official stamp. It confirms that Mr. Mohamed conducted discussions with administrative staff, clinic management, and nursing staff, and that the five categories of system requirements documented — covering role-based access control, patient records management, audit trail, data security and recovery, and cloud-based deployment — accurately reflect the clinic's operational needs.

---

### File Naming Guide (save your files with these exact names)

| File | Save As |
|---|---|
| Email screenshot 1 (sent) | `C1_email_sent_to_clinic.png` |
| Email screenshot 2 (reply) | `C2_email_reply_from_clinic.png` |
| UTM signed letter PDF | `C3_UTM_supervisor_letter_signed.pdf` |
| Clinic signed reply PDF | `C4_clinic_reply_letter_signed.pdf` |

Place all four files in your LaTeX project under: `appendix/`

---

### Cross-reference to use inside the Methodology chapter (Section 3)

Add this sentence wherever you describe your requirements elicitation:

```
The requirements were gathered through direct discussions with clinic staff comprising administrative personnel, 
clinic management, and nursing staff. A formal written confirmation of the requirements was subsequently obtained 
from the clinic management via official correspondence with the project supervisor 
(see Appendix C, Figures~\ref{fig:C3_utm_letter} and~\ref{fig:C4_clinic_letter}).
```
