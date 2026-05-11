# System Summary: Web-Based Academic Repository with Algorithmic Plagiarism Detection

## What the System Is
A centralized, secure web application for academic institutions that handles document submission, storage, and originality checking — replacing fragmented manual workflows with a structured digital platform.

---

## Step-by-Step: How the System Works

---

### Step 1 — User Access & Authentication
- A visitor opens the system homepage.
- **Guest users** can browse limited public document information without logging in.
- **Registered users** create an account (full name, email, password), then log in.
- Upon successful login, the server issues a **JWT (JSON Web Token)** that carries the user's identity and role (`guest`, `user`, or `admin`).
- The token is stored client-side and sent with every subsequent request for identity verification.

---

### Step 2 — Role-Based Access Control (RBAC)
After login, the system checks the user's role and grants permissions accordingly:

| Role | What They Can Do |
|---|---|
| **Guest** | Browse public document list only |
| **Registered User** | Upload, analyze own documents, run quick scans, view own reports |
| **Admin** | Everything a user can do + manage all users, all documents, and view statistics |

Every sensitive API endpoint is protected by middleware that validates the JWT and checks the role before allowing access.

---

### Step 3 — Document Upload
1. The user selects a file (**PDF, DOCX, or TXT**).
2. The system validates file type and size.
3. Text is **automatically extracted** from the file.
4. The user enters **metadata**: title, authors, course, year, and abstract.
5. The system runs **pre-upload policy checks**:
   - Is the title an exact duplicate of an existing document?
   - Does the content similarity exceed the configured threshold (e.g., 80%)?
   - Do flagged paragraphs exceed the allowed ratio (e.g., >30%)?
6. If all checks pass, the document and its paragraphs are saved to the **Supabase PostgreSQL** database.

---

### Step 4 — Plagiarism Detection (Core Algorithm)
When a registered user runs an analysis on their uploaded document:

1. **Preprocessing** — Text is lowercased, tokenized, and stopwords are removed.
2. **TF-IDF Weighting** — Each term is weighted by how often it appears in the document (TF) versus how rare it is across the entire corpus (IDF). This creates a numeric vector for the document.
3. **Document-Level Cosine Similarity** — The document's TF-IDF vector is compared against all other documents in the repository using the cosine similarity formula:

   cos θ = (A · B) / (||A|| × ||B||)

   Scores range from **0 (no match)** to **1 (identical)**.

4. **Paragraph-Level Matching** — The same process is repeated for each paragraph, flagging specific high-risk sections.
5. **n-gram Overlap Check** — Bigram/trigram phrase comparisons reduce false positives from generic academic vocabulary.
6. Results (similarity scores, matched documents, flagged paragraphs) are saved and tied to the document owner.

---

### Step 5 — Auxiliary Checking Features
Beyond the core algorithm, the system provides three additional checks:

| Feature | Description |
|---|---|
| **Title Similarity Check** | Compares the document title against existing titles in the repository |
| **Internet Snippet Matching** | Queries an internet search service and compares document paragraphs against web results |
| **Optional Semantic Analysis** | Calls an external AI service (e.g., OpenAI) for deeper meaning-level similarity assessment (requires valid API key) |

---

### Step 6 — Quick Scan (No Storage)
- Any user can upload a **temporary file** for a quick plagiarism check.
- The file is analyzed, results are returned immediately, and **no data is permanently saved** — the temporary file is deleted after processing.

---

### Step 7 — Report Viewing (Access-Controlled)
- Only the **document owner** and **admin** can view a full plagiarism report.
- Non-owners attempting to access another user's report receive an **HTTP 403 Forbidden** response.
- Reports include: overall similarity score, matched documents, paragraph-level flags, and flagged content sections.

---

### Step 8 — Admin Monitoring
Admin users have access to a dedicated dashboard where they can:
- View total users, documents, and paragraphs (repository statistics)
- Browse and delete any user account
- Browse and delete any document record
- Access all plagiarism reports regardless of ownership

---

### Step 9 — Logout & Session End
- The user clicks Logout.
- The JWT token is cleared from the client.
- The user is redirected to the homepage.
- Since the backend is **stateless** (JWT-based), no server-side session needs to be destroyed.

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (static pages) |
| Backend | Node.js + Express.js |
| Authentication | JSON Web Token (JWT) + bcrypt password hashing |
| Database | Supabase (PostgreSQL) |
| Text Analysis | Custom TF-IDF + Cosine Similarity (local) |
| Optional AI | OpenAI API (semantic analysis) |
| File Handling | PDF/DOCX/TXT extraction middleware |

---

## Abbreviations Used

| Abbreviation | Full Form |
|---|---|
| BSCS | Bachelor of Science in Computer Science |
| SDLC | Software Development Life Cycle |
| IPO | Input-Process-Output |
| TF-IDF | Term Frequency–Inverse Document Frequency |
| TF | Term Frequency |
| IDF | Inverse Document Frequency |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| REST / RESTful | Representational State Transfer |
| API | Application Programming Interface |
| HTTP | HyperText Transfer Protocol |
| PDF | Portable Document Format |
| DOCX | Document (Microsoft Word Open XML format) |
| TXT | Plain Text (file format) |
| AI | Artificial Intelligence |
| SDG | Sustainable Development Goal |
| OAI-PMH | Open Archives Initiative Protocol for Metadata Harvesting |
| URL | Uniform Resource Locator |
| RFC | Request for Comments |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| TC | Test Case |
| PK | Primary Key |
| FK | Foreign Key |
| UK | Unique Key |
| ID | Identifier |
| IEEE | Institute of Electrical and Electronics Engineers |
| ACM | Association for Computing Machinery |
| IETF | Internet Engineering Task Force |
| ARL | Association of Research Libraries |
| ICSE | International Conference on Software Engineering |
| SIGMOD | Special Interest Group on Management of Data |
| COLING | International Conference on Computational Linguistics |
