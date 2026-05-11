# NEW CAPSTONE PROJECT FORMAT
# BACHELOR OF SCIENCE IN COMPUTER SCIENCE

---

# WEB-BASED ACADEMIC REPOSITORY WITH PLAGIARISM DETECTION USING TF-IDF AND COSINE SIMILARITY

---

A Capstone Project

Presented to the

College of Computer Studies

Sulu State University

Jolo, Sulu, Philippines

In Partial Fulfillment of the Requirements
for the Capstone Project

Academic Year 2026-2027

---

## DEDICATION

This capstone project is dedicated to the students, teachers, administrators, and future researchers who value academic honesty and organized document management. May this system help promote better academic writing, faster document checking, and responsible use of technology in education.

This project is also dedicated to our families, instructors, and mentors who gave support, guidance, and encouragement throughout the development of this study. We are grateful for the patience, wisdom, and belief in our capabilities that kept us driven to complete this work.

---

## TABLE OF CONTENTS

- Dedication
- Table of Contents
- List of Figures
- List of Tables
- Executive Summary
- Keywords

**CHAPTER I - INTRODUCTION**
- 1.1 Project Context
- 1.2 Purpose and Description
- Statement of the Problem
- 1.3 Objectives
  - 1.3.1 General Objective
  - 1.3.2 Specific Objectives
- 1.4 Significance of the Project
- 1.5 Scope and Delimitation

**CHAPTER II - REVIEW OF RELATED LITERATURE / SYSTEM TECHNICAL BACKGROUND**

**CHAPTER III - METHODS**
- 3.1 Model / SDLC
- 3.2 Data Gathering
- 3.3 Requirements Analysis
- 3.4 Requirements Documentation
- 3.5 Design of Software, Systems, Product, and/or Processes
  - 3.5.1 Conceptual Framework
  - 3.5.2 Detailed Design
    - 3.5.2.1 System Overview Diagram
    - 3.5.2.2 Account-Based Flow Diagram
    - 3.5.2.3 Standard/User Account Flow Diagram
    - 3.5.2.4 System Process Flow (Login to Exit)
- 3.6 Algorithms
- 3.7 Capstone Element
  - 3.7.1 Software Requirements and Development
  - 3.7.2 Implementation
  - 3.7.3 Testing and Validation

**CHAPTER IV - RESULTS AND DISCUSSION**

**CONCLUSION AND RECOMMENDATION**

**REFERENCES**

---

## LIST OF FIGURES

- Figure 1. Agile SDLC Model
- Figure 2. IPO Conceptual Framework of the System
- Figure 3. System Overview Architecture Diagram
- Figure 4. Admin Account Flow Diagram
- Figure 5. User Account Flow Diagram
- Figure 6. System Process Flowchart
- Figure 7. Text Extraction Flowchart
- Figure 8. Plagiarism Detection Algorithm Flowchart
- Plate 1. Landing Page of the System

---

## LIST OF TABLES

- Table 1. Functional Requirements
- Table 2. Non-Functional Requirements
- Table 3. User Roles and Access Rights
- Table 4. System Components
- Table 5. Database Tables and Descriptions
- Table 6. Software Requirements
- Table 7. Testing and Validation Results

---

## EXECUTIVE SUMMARY

Academic institutions continuously generate research outputs, thesis manuscripts, and other scholarly documents. However, many schools still rely on manual file handling, fragmented storage practices, and limited originality checking, which can lead to inefficient retrieval, duplicate submissions, and delayed validation of document integrity. To address these concerns, this study developed a Web-Based Academic Repository with Plagiarism Detection Using TF-IDF and Cosine Similarity.

The system provides a centralized repository where registered users can upload academic documents in PDF, DOCX, or TXT format, encode metadata, and run plagiarism analysis. Registered users can upload academic documents and view similarity results, while administrators can manage users, documents, and reports. The system uses text extraction, TF-IDF, and cosine similarity to compare uploaded documents with stored documents and generate similarity scores and matched text.

Security and governance are embedded through role-based access control, JSON Web Token authentication, and owner-restricted report visibility with administrative override. The administrator can monitor users, documents, and repository statistics, while guest users are limited to selected public document information. The backend is implemented using Node.js and Express.js, with Supabase PostgreSQL as the data layer.

The development followed the Agile Software Development Life Cycle. The system was planned, designed, developed, tested, and improved through continuous feedback. Testing results showed that the main functions — including registration, login, document upload, text extraction, similarity checking, report viewing, and logout — worked successfully. The developed system improves academic repository management by reducing manual checking effort, enabling structured digital archiving, and supporting fairer originality assessment.

---

## KEYWORDS

Web-Based Academic Repository, Plagiarism Detection, TF-IDF, Cosine Similarity, Document Similarity, Role-Based Access Control, Supabase, Node.js, Academic Integrity, Digital Transformation

---

# CHAPTER I
# INTRODUCTION

This chapter presents the background of the study, purpose and description of the proposed system, statement of the problem, objectives, significance, and scope and delimitation. It introduces the need for a web-based academic repository that can store documents and check document similarity in a more organized and measurable way.

## 1.1 Project Context

Digital transformation has become a foundational strategy in education, particularly in managing records, research archives, and quality assurance processes. Web-based repositories are now used to store research outputs, organize documents, and make academic records easier to access. Plagiarism detection systems also help institutions check the originality of submitted works and support fair academic evaluation.

In many local academic institutions, document submission and plagiarism checking are still partly manual. Students submit research papers and other academic documents, while instructors or administrators check originality using separate tools or manual review. This process may take time and may produce inconsistent results because the documents are not stored and checked in one centralized platform.

As document volume grows per semester, manual checking for similarity and originality becomes increasingly difficult, especially when reviewers must compare multiple files within limited timelines. The absence of a structured and centralized digital system also makes it harder to retrieve past submissions and ensure consistent evaluation standards. These challenges are consistent with institutional repository literature that emphasizes stewardship, discoverability, and policy control as core success factors (Lynch, 2003; Smith et al., 2003).

Based on observation of the existing process, common problems include slow plagiarism checking, lack of a centralized repository, difficulty in detecting partial similarities, and limited access control. These problems may affect the quality of document management and the protection of academic integrity.

To address these problems, this study proposes a Web-Based Academic Repository with Plagiarism Detection Using TF-IDF and Cosine Similarity. The system is a web-based platform that allows academic documents to be uploaded, stored, analyzed, and monitored in a more organized and secure manner.

## 1.2 Purpose and Description

This study aims to design and develop a web-based academic repository with automated plagiarism detection. The purpose of the system is to improve academic document management and provide a simple and reliable way to check document similarity.

The system has three types of users: guest users, registered users, and administrators. Guest users can access limited public information about the system. Registered users can upload documents, input metadata, and check similarity results. Administrators can manage user accounts, uploaded documents, and plagiarism reports. The system uses secure authentication and access control to ensure that only authorized users can perform specific actions.

The plagiarism detection feature uses text extraction, TF-IDF, and cosine similarity. After a document is uploaded, the system extracts the text, computes word importance using TF-IDF weighting, compares the document with saved documents in the repository, and displays the similarity score and matched text. This approach is grounded in information retrieval research that supports interpretable, vector-based similarity scoring for practical educational use (Salton, Wong, & Yang, 1975; Spärck Jones, 1972; Alzahrani, Salim, & Abraham, 2012).

## Statement of the Problem

The current process of managing academic documents and checking plagiarism is still difficult because some tasks are done manually. Documents are not stored in one central place, checking originality takes time, and similar content is difficult to identify without a standardized system. This study seeks to answer the following questions:

1. What problems are encountered in the current process of managing and checking academic documents?
2. How can a web-based repository improve the storage, management, and retrieval of academic documents?
3. How can TF-IDF and cosine similarity be used to detect document similarity and support plagiarism checking?

## 1.3 Objectives

This section presents the general and specific objectives of the project. These objectives are aligned with the identified problems in academic document management and plagiarism checking.

### 1.3.1 General Objective

The general objective of this study is to design and develop a web-based academic repository with plagiarism detection using TF-IDF and cosine similarity for storing, managing, and checking academic documents in an academic institution.

### 1.3.2 Specific Objectives

1. To assess the current academic document management and plagiarism detection workflow and identify its problems, security gaps, and technical limitations.
2. To design and develop a secure web-based repository that allows users to upload, organize, and retrieve academic documents in PDF, DOCX, and TXT formats.
3. To integrate a similarity detection module using text extraction, TF-IDF, and cosine similarity to measure the relatedness between academic documents at the document and paragraph level.
4. To develop user and administrator modules for account access, document management, report viewing, and system monitoring.
5. To implement role-based access control and token-based authentication to protect user accounts, uploaded documents, and plagiarism reports.
6. To test and validate the system based on functionality, usability, reliability, efficiency, and security.
7. To evaluate the effectiveness of the platform in reducing manual checking burden and improving document governance.
8. To deploy the system in a cloud-ready setup and provide technical documentation for maintenance and future enhancement.

## 1.4 Significance of the Project

This study is significant to multiple stakeholders in the academic community.

**Students.** The system gives students a convenient way to upload academic documents and check the originality of their work. It can help students become more aware of proper academic writing and avoid possible plagiarism, promoting responsible scholarly behavior.

**Teachers and Faculty Advisers.** The study is useful to teachers because it reduces the time needed for manual checking. Through automatic similarity checking, teachers can review submitted documents more efficiently and focus more on evaluating the quality of the content.

**Administrators.** The system is also helpful to administrators because it provides a centralized platform for monitoring users, documents, and plagiarism reports. This supports better document organization and strengthens academic integrity in the institution.

**Future Researchers.** Future researchers may use this study as a reference for developing related systems involving document repositories, plagiarism detection, text mining, and similarity analysis. Student developers may also gain knowledge in web development, database design, and algorithm implementation.

The study aligns with key Sustainable Development Goals: SDG 4 (Quality Education) through improved academic quality processes, SDG 9 (Industry, Innovation, and Infrastructure) through digital system innovation, and SDG 16 (Peace, Justice, and Strong Institutions) by strengthening accountability and transparency in academic record management.

## 1.5 Scope and Delimitation

The scope of this study focuses on the development of a web-based academic repository with plagiarism detection. The system allows users to register, log in, upload documents, extract text, check similarity, view results, and generate reports. It supports PDF, DOCX, and TXT file formats. The system uses TF-IDF to represent document terms and cosine similarity to compute similarity scores at both document and paragraph levels.

The system includes three user account types (guest, registered user, and administrator), role-based access control, metadata management (title, authors, course, year, and abstract), document browsing, and an administrative dashboard for monitoring users and documents.

The study is limited to documents uploaded within the system database. It does not check the entire internet and does not use advanced artificial intelligence or deep learning models as its primary detection engine. The system also does not provide full multilingual plagiarism detection. Its accuracy depends on the quality of extracted text and the volume of available documents stored in the repository. These constraints are consistent with published limitations in plagiarism detection studies, particularly for transformed, idea-level, and cross-source plagiarism patterns (Eisa, Salim, & Alzahrani, 2015).

---

# CHAPTER II
# REVIEW OF RELATED LITERATURE / SYSTEM TECHNICAL BACKGROUND

This chapter presents the literature and studies related to academic repositories, plagiarism detection, web-based systems, and document similarity algorithms. These references support the development of the proposed system and show the importance of using digital tools in academic document management.

## 2.1 Related Literature on Academic Digital Repositories

Institutional repositories play an important role in preserving and sharing scholarly output in higher education. Lynch (2003) explained that repositories are not only storage systems but also institutional commitments to stewardship, access, and permanence. This idea is supported by literature on DSpace, where Smith et al. (2003) presented repository architecture as a response to the increasing number of digital academic materials and the need for institutional ownership of knowledge resources.

Sustainability, interoperability, and policy governance are also important factors in repository success. Smith et al. (2003) discussed the operational realities of repository implementation, including the balance between open access, preservation, and sustainable software architecture. These concepts support the need for modular platforms with user roles, metadata management, and workflow auditing.

Repository ecosystems also developed through interoperability standards. The Open Archives Initiative Protocol for Metadata Harvesting (OAI-PMH) provides a formal method for exposing and harvesting metadata in repositories (Van de Sompel et al., 2002). This supports distributed discovery while allowing institutions to maintain local control of their records.

## 2.2 Related Literature on Plagiarism Detection

Plagiarism detection studies have developed from exact matching into lexical, structural, and semantic approaches. One structural method is document fingerprinting, where representative text signatures are compared to detect matches. Schleimer, Wilkerson, and Aiken (2003) introduced the winnowing method, which uses local fingerprinting to identify similarities in large text collections.

Another major approach is based on text representation in vector space. Salton, Wong, and Yang (1975) introduced the vector space model for automatic indexing, while Spärck Jones (1972) provided the statistical interpretation of term specificity used in inverse document frequency weighting. These concepts continue to support many plagiarism detection systems because they are explainable, computationally practical, and useful for document ranking.

Recent reviews show that plagiarism detection is a multidimensional problem. Alzahrani, Salim, and Abraham (2012) studied linguistic patterns, textual features, and detection methods. Eisa, Salim, and Alzahrani (2015) mapped existing detection techniques and identified gaps in detecting idea plagiarism, visual artifacts, and heavily transformed content. Other studies also show that plagiarism systems differ depending on the type of plagiarism they aim to detect (Kakkonen & Mozgovoy, 2010).

Community benchmarking also helps validate detection methods. Potthast, Stein, Barrón-Cedeño, and Rosso (2010) proposed evaluation frameworks for plagiarism detection to improve comparison among tools and methods. This supports the design principle that system outputs should be measurable, reproducible, and analyzable at document and segment levels.

## 2.3 System Technical Background

The proposed system combines literature-supported methods with a modern web architecture. The detection core uses TF-IDF-inspired term weighting and cosine similarity to rank documents and identify possible overlaps. This approach is aligned with information retrieval fundamentals (Manning, Raghavan, & Schütze, 2008) and provides interpretable scores and matched text.

The system follows a client-server implementation. It includes a browser-based interface, backend services for document processing, and a data layer for storing users, documents, paragraphs, and similarity results. Role-based access control separates guest, registered user, and administrator activities, following established RBAC principles for least privilege and administrative separation (Sandhu, Coyne, Feinstein, & Youman, 1996).

Security and reliability are treated as important requirements. Authentication using JSON Web Tokens (Jones, Bradley, & Sakimura, 2015), protected endpoints, file upload restrictions, and controlled processing flows help make the system safer for academic use. The system architecture also allows future improvements, such as semantic checking and internet-assisted matching, without replacing the explainable detection pipeline.

## 2.4 Synthesis and Research Gap

Reviewed literature confirms that institutional repositories and plagiarism detection systems are both mature domains, yet practical gaps remain in small-to-medium academic environments. Many institutions still struggle to combine repository governance, user-based access policies, and transparent similarity analytics into a single operational platform. Existing solutions are often fragmented: some focus on storage and retrieval, while others emphasize similarity checking without full repository lifecycle management.

The research gap addressed by this study is the need to integrate repository management and algorithmic plagiarism detection into one policy-aware web application suitable for academic processes. The project applies repository features, metadata handling, document and paragraph similarity, and report-based access control into a single institutional system.

---

# CHAPTER III
# METHODS

This chapter presents the methods used in the development of the Web-Based Academic Repository with Plagiarism Detection. It includes the development model, data gathering process, requirements analysis, system design, algorithms, implementation, and testing procedure.

## 3.1 Model / SDLC

The system uses the Agile Software Development Life Cycle (SDLC) model. Agile was selected because it allows the proponents to develop the system step by step and improve the system based on testing and feedback. Each module is designed, developed, tested, and improved before moving to the next feature.

The Agile model is suitable for this study because the system includes several modules such as user registration, login, document upload, text extraction, plagiarism checking, result viewing, and admin management. These modules can be developed and tested in small, manageable increments. This iterative approach is supported by empirical software engineering literature showing practical value in adaptive planning and continuous requirement refinement for evolving project needs (Cao & Ramesh, 2008).

**Figure 1. Agile SDLC Model**

```
┌────────────────────────────────────────────────────┐
│                  Agile SDLC Model                  │
│                                                    │
│   ┌───────────┐                                    │
│   │ Planning  │◄──────────────────────────┐        │
│   └─────┬─────┘                           │        │
│         ↓                                 │        │
│   ┌─────────────┐                         │        │
│   │Data Gathering│                        │        │
│   └──────┬──────┘                         │        │
│          ↓                      Feedback  │        │
│   ┌──────────┐                      and   │        │
│   │  Design  │                Improvement │        │
│   └────┬─────┘                            │        │
│        ↓                                  │        │
│   ┌───────────────┐                       │        │
│   │  Development  │─────────────────────► │        │
│   └──────┬────────┘                       │        │
│          ↓                                │        │
│   ┌──────────┐                            │        │
│   │  Testing │                            │        │
│   └────┬─────┘                            │        │
│        ↓                                  │        │
│   ┌────────────┐                          │        │
│   │ Deployment │                          │        │
│   └──────┬─────┘                          │        │
│          ↓                                │        │
│   ┌─────────────┐                         │        │
│   │ Maintenance │─────────────────────────┘        │
│   └─────────────┘                                  │
└────────────────────────────────────────────────────┘
```

Figure 1 shows the Agile SDLC model used in the development of the system. It presents the process from planning, data gathering, design, development, testing, deployment, and maintenance. Feedback is used to improve the system in each development cycle.

The development steps are as follows. In **planning**, the proponents identify the system users and problems. In **data gathering**, interviews, observations, and document review are conducted. In **design**, the proponents prepare the database schema, system flow, and user interface. In **development**, each module is created and integrated into the system. In **testing**, errors are identified and corrected. In **deployment**, the system is made available through a web browser. In **maintenance**, the system is monitored for future updates and improvements.

## 3.2 Data Gathering

Data gathering was conducted at the College of Computer Studies to understand the existing process of academic document submission and plagiarism checking. The researchers used interviews, observation, and document review to identify the problems and system requirements.

**Interviews** were conducted with students and teachers to understand how academic documents are currently submitted, stored, and checked. The responses helped identify the need for a faster and more organized system.

**Observation** was also done to understand the existing manual process. The proponents observed that document submission and checking can be time-consuming when there is no central repository and when originality verification is handled by separate, disconnected tools.

**Document review** was used to examine sample academic files and existing records. This helped the proponents identify the needed data fields, file types, and report requirements for the proposed system.

## 3.3 Requirements Analysis

After gathering information, the researchers analyzed the needs of the users and the problems in the existing process. The main problems identified were the lack of a centralized document repository, slow plagiarism checking, difficulty in comparing documents at the paragraph level, and limited monitoring of academic submissions.

The **functional requirements** describe what the system must do. These include user registration, login, document upload, metadata management, text extraction, similarity checking, result display, and admin management. The **non-functional requirements** describe how the system should perform. These include security, usability, reliability, speed, and accessibility through a web browser.

## 3.4 Requirements Documentation

The requirements documentation presents the functional and non-functional requirements of the system. These requirements serve as a guide for the development and testing of the proposed system.

**Table 1. Functional Requirements**

| Req. ID | Requirement Description | Priority |
|---------|------------------------|----------|
| FR-01 | The system shall allow users to register an account. | High |
| FR-02 | The system shall allow users to log in securely. | High |
| FR-03 | The system shall allow users to upload PDF, DOCX, and TXT documents. | High |
| FR-04 | The system shall extract text from uploaded documents. | High |
| FR-05 | The system shall collect metadata including title, authors, course, year, and abstract. | High |
| FR-06 | The system shall compute TF-IDF values from extracted text. | High |
| FR-07 | The system shall compare documents using cosine similarity at document and paragraph levels. | High |
| FR-08 | The system shall display similarity score and matched text. | High |
| FR-09 | The system shall allow administrators to manage users, documents, and reports. | High |

**Table 2. Non-Functional Requirements**

| Req. ID | Requirement Description | Priority |
|---------|------------------------|----------|
| NFR-01 | The system shall be easy to understand and use. | High |
| NFR-02 | The system shall protect user accounts and uploaded documents through authentication. | High |
| NFR-03 | The system shall be accessible through modern web browsers. | High |
| NFR-04 | The system shall process documents within a reasonable time. | Medium |
| NFR-05 | The system shall store and retrieve records reliably. | High |
| NFR-06 | The system shall enforce role-based access to restrict unauthorized operations. | High |
| NFR-07 | The system shall be maintainable for future improvements. | Medium |

**Table 3. User Roles and Access Rights**

| User Role | Access Rights |
|-----------|---------------|
| Guest User | Can view limited public information about the system and repository. |
| Registered User | Can register, log in, upload documents, check similarity, and view results for owned documents. |
| Administrator | Can manage user accounts, uploaded documents, similarity reports, and system records. |

## 3.5 Design of Software, Systems, Product, and/or Processes

This section presents the design of the proposed Web-Based Academic Repository with Plagiarism Detection. It includes the conceptual framework, system overview, account-based flows, user account flow, and system process flow from login to exit.

### 3.5.1 Conceptual Framework

The conceptual framework follows the Input-Process-Output (IPO) model. The **input** includes user credentials, uploaded documents in PDF, DOCX, or TXT format, document metadata, and user roles. The **process** includes text extraction, TF-IDF computation, cosine similarity checking at document and paragraph levels, and report generation. The **output** includes similarity scores, matched text, plagiarism reports, and stored document records.

**Figure 2. IPO Conceptual Framework of the System**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       IPO Conceptual Framework                           │
├──────────────────┬───────────────────────────────┬───────────────────────┤
│      INPUT       │           PROCESS             │        OUTPUT         │
├──────────────────┼───────────────────────────────┼───────────────────────┤
│                  │                               │                       │
│ • User           │ • Text Extraction             │ • Similarity Score    │
│   Credentials   │ • TF-IDF Computation          │ • Matched Text        │
│ • Uploaded       │ • Cosine Similarity           │ • Plagiarism Report   │
│   Documents      │   (Document & Paragraph)      │ • Stored Document     │
│   (PDF/DOCX/TXT)│ • Report Generation           │   Records             │
│ • Document       │ • Role-Based Access           │ • Admin Monitoring    │
│   Metadata       │   Enforcement                 │   Dashboard           │
│ • User Role      │                               │                       │
└──────────────────┴───────────────────────────────┴───────────────────────┘

The system receives user and document data, analyzes and compares documents,
then displays reports and results based on user role and ownership.
```

Figure 2 shows the IPO conceptual framework of the system. The input data are processed by the plagiarism detection module, and the system produces similarity results, matched text, reports, and stored document records.

### 3.5.2 Detailed Design

The system is designed with three main layers: **presentation layer**, **application layer**, and **data layer**. These layers work together to provide the complete functions of the system.

- The **presentation layer** contains the web pages used by guest users, registered users, and administrators.
- The **application layer** contains the backend logic for validation, document processing, TF-IDF computation, cosine similarity checking, and API request handling.
- The **data layer** stores user accounts, documents, extracted text, paragraph segments, and plagiarism results.

**Table 4. System Components**

| Component | Description |
|-----------|-------------|
| Frontend | Displays the web pages used by guest users, registered users, and administrators. |
| Backend | Handles file upload, text extraction, TF-IDF computation, cosine similarity, and API requests using Node.js and Express.js. |
| Database | Stores user accounts, documents, extracted text, paragraphs, and similarity reports using Supabase PostgreSQL. |
| Authentication | Protects user access through secure login, JWT token issuance, and role-based permissions. |

**Table 5. Database Tables and Descriptions**

| Table Name | Description |
|------------|-------------|
| users | Stores account information, user roles, hashed passwords, and login details. |
| documents | Stores uploaded document details such as filename, format, metadata, owner, and date uploaded. |
| paragraphs | Stores individual paragraph segments extracted from uploaded documents for granular comparison. |
| plagiarism_results | Stores similarity scores, matched text, matched documents, and comparison details. |
| reports | Stores generated plagiarism reports for viewing and administrative monitoring. |

#### 3.5.2.1 System Overview Diagram

**Figure 3. System Overview Architecture Diagram**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         System Overview Diagram                          │
│                                                                          │
│  ┌────────────┐                                                          │
│  │ Guest User │──┐                                                       │
│  └────────────┘  │       ┌──────────────────┐   ┌──────────────────────┐│
│                  ├──────►│  Web Interface   │──►│ Authentication and   ││
│  ┌──────────────┐│       │    (Browser)     │   │   Access Control     ││
│  │Registered    ││       └────────┬─────────┘   └──────────────────────┘│
│  │   User       ├┘                │                                      │
│  └──────────────┘                 ▼                                      │
│                        ┌──────────────────────┐                          │
│  ┌──────────────┐      │  Backend API and     │                          │
│  │Administrator │─────►│  Document Logic      │                          │
│  └──────────────┘      │  (Node.js/Express)   │                          │
│                        └──────────┬───────────┘                          │
│                                   │                                      │
│                                   ▼                                      │
│                  ┌─────────────────────────────────────┐                 │
│                  │   Database (Supabase PostgreSQL)     │                 │
│                  │  Users | Documents | Paragraphs      │                 │
│                  │  Plagiarism Results | Reports        │                 │
│                  └─────────────────────────────────────┘                 │
│                                                                          │
│   Users access the system through a browser.                            │
└──────────────────────────────────────────────────────────────────────────┘
```

Figure 3 presents the main components of the system. Guest users, registered users, and administrators access the web interface through a browser. The system uses authentication, backend logic, document processing services, and database storage to complete the repository and plagiarism detection process.

#### 3.5.2.2 Account-Based Flow Diagram

**Figure 4. Admin Account Flow Diagram**

```
                    Admin Account Flow Diagram

                        ┌───────┐
                        │ Start │
                        └───┬───┘
                            │
                            ▼
                   ┌─────────────────┐
             ┌────►│Enter Admin Login│
             │     └───────┬─────────┘
             │             │
             │             ▼
             │    ┌──────────────────┐  No   ┌──────────────────┐
             │    │  Valid Account?  │──────►│Display Invalid   │
             │    └────────┬─────────┘       │     Login        │──┐
             │             │ Yes             └──────────────────┘  │
             │             ▼                                        │
             │    ┌──────────────────────┐                         │
             │    │  Open Admin Dashboard│                         │
             │    └──────────┬───────────┘                         │
             │               │                                      │
             │               ▼                                      │
             │    ┌──────────────────────────┐                     │
             │    │Manage Users, Documents,  │                     │
             │    │     and Reports          │                     │
             │    └──────────┬───────────────┘                     │
             │               │                                      │
             │               ▼                                      │
             │    ┌──────────────────────────┐                     │
             │    │View or Print Similarity  │                     │
             │    │        Reports           │                     │
             │    └──────────┬───────────────┘                     │
             │               │                                      │
             │               ▼                                      │
             │          ┌────────┐                                  │
             └──────────│ Logout │                                  │
                        └───┬────┘            ◄─────────────────────┘
                            │
                            ▼
                         ┌─────┐
                         │ End │
                         └─────┘
```

Figure 4 shows the process followed by the administrator. The admin logs in, the system verifies the account and role, and the admin dashboard opens if the account is valid. The administrator can manage users, documents, and reports before logging out of the system. All admin routes are protected by middleware-level authorization that validates JWT tokens and verifies admin role claims, rejecting non-admin requests with HTTP 403 Forbidden responses (Sandhu et al., 1996).

#### 3.5.2.3 Standard/User Account Flow Diagram

**Figure 5. User Account Flow Diagram**

```
                    User Account Flow Diagram

                        ┌───────┐
                        │ Start │
                        └───┬───┘
                            │
                            ▼
                   ┌─────────────────────┐
             ┌────►│  Register or Login  │
             │     └──────────┬──────────┘
             │                │
             │                ▼
             │   ┌───────────────────────┐  No  ┌──────────────────────┐
             │   │   Valid Account?      │──────►│Display Invalid Login │──┐
             │   └───────────┬───────────┘       └──────────────────────┘  │
             │               │ Yes                                          │
             │               ▼                              ◄───────────────┘
             │   ┌───────────────────────┐
             │   │   Open User Dashboard │
             │   └───────────┬───────────┘
             │               │
             │               ▼
             │   ┌───────────────────────┐
             │   │    Upload Document    │
             │   └───────────┬───────────┘
             │               │
             │               ▼
             │   ┌───────────────────────────┐
             │   │  Extract Text and Check   │
             │   │       Similarity          │
             │   └───────────┬───────────────┘
             │               │
             │               ▼
             │   ┌───────────────────────┐
             │   │Display Similarity     │
             │   │       Result          │
             │   └───────────┬───────────┘
             │               │
             │               ▼
             │          ┌──────────┐
             └──────────│  Logout  │
                        └────┬─────┘
                             │
                             ▼
                          ┌─────┐
                          │ End │
                          └─────┘
```

Figure 5 shows the process followed by a registered user. The user registers or logs in, uploads a document with metadata, and views the similarity result after the system completes text extraction and plagiarism checking. Report access is restricted to the document owner and the administrator through middleware-level authorization that checks document ownership before returning full similarity details.

#### 3.5.2.4 System Process Flow (Login to Exit)

**Figure 6. System Process Flowchart**

```
                      System Process Flowchart

                           ┌───────┐
                           │ Start │
                           └───┬───┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   User Opens System  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
              ┌────►│  Login or Register   │
              │     └──────────┬───────────┘
              │                │
              │                ▼
              │   ┌──────────────────────────┐  No  ┌──────────────────┐
              │   │   Credentials Valid?      │──────►│Display Invalid  │──┐
              │   └──────────────┬────────────┘       │     Login       │  │
              │                  │ Yes                └──────────────────┘  │
              │                  ▼                           ◄──────────────┘
              │       ┌──────────────────────┐
              │       │   Open Dashboard     │
              │       └──────────┬───────────┘
              │                  │
              │                  ▼
              │       ┌──────────────────────┐
              │       │   Upload Document    │◄─────────────────────────┐
              │       └──────────┬───────────┘                          │
              │                  │                                       │
              │                  ▼                                       │
              │       ┌──────────────────────┐                           │
              │       │    Extract Text      │                           │
              │       └──────────┬───────────┘                           │
              │                  │                                       │
              │                  ▼                                       │
              │       ┌──────────────────────┐                           │
              │       │    Apply TF-IDF      │                           │
              │       └──────────┬───────────┘                           │
              │                  │                                       │
              │                  ▼                                       │
              │       ┌──────────────────────┐                           │
              │       │ Compute Cosine       │                           │
              │       │   Similarity         │                           │
              │       └──────────┬───────────┘                           │
              │                  │                                       │
              │                  ▼                        Yes             │
              │       ┌──────────────────────┐       ┌──────────────────┐│
              │       │Display Similarity    │──────►│Analyze Another   ││
              │       │       Result         │       │  Document?       ││
              │       └──────────┬───────────┘       └──────────────────┘│
              │                  │ No                           │Yes      │
              │                  ▼                              └─────────┘
              │          ┌──────────┐
              └──────────│  Logout  │
                         └────┬─────┘
                              │
                              ▼
                           ┌─────┐
                           │ End │
                           └─────┘
```

Figure 6 shows the overall system process from login or registration up to logout. The user opens the system, enters login or registration details, and the system validates the account. If the account is invalid, the system displays an error message and returns to the login step. If the account is valid, the dashboard opens and the user can upload a document. The system extracts the text, applies TF-IDF, computes cosine similarity, and displays the similarity result. The user may analyze another document or log out to end the session.

## 3.6 Algorithms

The system uses text extraction, TF-IDF, and cosine similarity algorithms. These algorithms allow the system to read document content, identify important words, and compute the similarity between documents.

### 3.6.1 Text Extraction Algorithm

Text extraction is the process of obtaining readable text from an uploaded document. When the user uploads a file, the system checks the file type. If the file is valid (PDF, DOCX, or TXT), the system reads the document, extracts the text, normalizes and cleans the content, and saves it in the database for plagiarism checking.

**Figure 7. Text Extraction Flowchart**

```
                      Text Extraction Flowchart

                           ┌───────┐
                           │ Start │
                           └───┬───┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Upload Document    │
                    └──────────┬───────────┘
                               │
                               ▼
            ┌──────────────────────────────────┐  No  ┌──────────────────┐
            │      Valid File Type?            │──────►│ Display Invalid  │
            │    (PDF / DOCX / TXT)            │       │      File        │
            └──────────────┬───────────────────┘       └──────────────────┘
                           │ Yes
                           ▼
                  ┌──────────────────────────┐
                  │  Read Document Content   │
                  └──────────────┬───────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │  Extract Readable Text   │
                  └──────────────┬───────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │ Clean and Normalize Text │
                  │  (lowercase, remove      │
                  │   special characters)    │
                  └──────────────┬───────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │  Save Extracted Text     │
                  │  to Database             │
                  └──────────────┬───────────┘
                                 │
                                 ▼
                              ┌─────┐
                              │ End │
                              └─────┘
```

Figure 7 shows the flow of text extraction. The system receives an uploaded document, checks if the file type is valid, reads the document content, extracts readable text, cleans and normalizes it, and saves the result for similarity checking.

### 3.6.2 TF-IDF Algorithm

TF-IDF means Term Frequency-Inverse Document Frequency. It is used to determine the importance of a word in a document relative to all documents in the repository. Common words receive lower values, while important or rare words receive higher values. The formula is:

**TF-IDF = TF × IDF**

Where:

- **TF (Term Frequency)** refers to how often a word appears in a single document. It reflects the local importance of the term within the document.
- **IDF (Inverse Document Frequency)** refers to how important or rare the word is across all documents in the corpus, computed as log(N/df), where N is the total number of documents and df is the number of documents containing the term.

The system uses the TF-IDF result to create a weighted vector representation of each document for mathematical comparison. This approach is consistent with foundational information retrieval literature (Salton et al., 1975; Spärck Jones, 1972; Manning et al., 2008).

### 3.6.3 Cosine Similarity Algorithm

Cosine similarity measures how similar two documents are based on their TF-IDF vectors. The result ranges from 0 to 1. A score closer to 0 means the documents are less similar, while a score closer to 1 means the documents are more similar. The formula is:

**Cosine Similarity = (A · B) / (|A| × |B|)**

Where A and B are the TF-IDF vectors of two documents, (A · B) is their dot product, and |A| and |B| are their magnitudes.

In this system, the uploaded document is compared with the documents stored in the database at both the document and paragraph level. The system calculates the similarity score and displays the matched content to the user.

**Figure 8. Plagiarism Detection Algorithm Flowchart**

```
               Plagiarism Detection Algorithm Flowchart

                            ┌───────┐
                            │ Start │
                            └───┬───┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │ Receive Extracted Text │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │   Preprocess Words     │
                   │ (tokenize, normalize,  │
                   │  remove stopwords)     │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │ Compute TF-IDF Vector  │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │Compare with Saved Docs │
                   │  (Document Level and   │
                   │  Paragraph Level)      │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │ Compute Cosine         │
                   │   Similarity Score     │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────────┐
                   │   Score Above Threshold?   │
                   └──────┬─────────────────────┘
                          │
              ┌───────────┴──────────────┐
              │ Yes = High Similarity    │ No = Low Similarity
              ▼                          ▼
     ┌────────────────┐         ┌────────────────────┐
     │Flag as Match   │         │  No Match Found    │
     └───────┬────────┘         └────────────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │Generate Similarity Report│
  │  (scores, matched text,  │
  │   flagged paragraphs)    │
  └──────────────┬───────────┘
                 │
                 ▼
              ┌─────┐
              │ End │
              └─────┘
```

Figure 8 shows how the system detects similarity. The extracted text is preprocessed and tokenized, converted into a TF-IDF vector, compared with stored documents using cosine similarity at both document and paragraph levels, and used to generate a detailed similarity report.

## 3.7 Capstone Element

This section presents the software requirements, implementation process, and testing and validation procedures used in the development of the capstone project.

### 3.7.1 Software Requirements and Development

The following software tools are used to develop and run the proposed system.

**Table 6. Software Requirements**

| Software / Tool | Purpose |
|----------------|---------|
| HTML5 | Used for creating the structure of web pages. |
| CSS3 | Used for designing and styling the system interface. |
| JavaScript | Used for client-side functions and user interactions. |
| Node.js / Express.js | Used for server-side document processing and RESTful API logic. |
| Supabase / PostgreSQL | Used for storing users, documents, extracted text, paragraphs, and similarity results. |
| Multer | Used for handling file upload middleware and validation. |
| pdf-parse / mammoth | Used for extracting text from PDF and DOCX files respectively. |
| JSON Web Token (JWT) | Used for secure token-based authentication and role claims. |
| bcrypt | Used for password hashing before database storage. |
| Visual Studio Code | Used as the code editor during development. |
| Web Browser | Used to access and test the web application. |

Software development follows a modular coding approach: **routes** define endpoint contracts, **controllers** orchestrate request-response logic, **services** encapsulate extraction and scoring functions, and **middleware** enforces authentication and authorization. Security implementation is based on role-based authorization at protected endpoints and token-based authentication for session continuity in stateless HTTP interactions (Sandhu et al., 1996; Jones et al., 2015). Password handling uses bcrypt-style hashing, which remains resilient as hardware capabilities increase.

### 3.7.2 Implementation

The system is implemented as a full-stack web-based application that can be accessed through a browser. Users can register, log in, upload documents, and view plagiarism checking results. When a document is uploaded, the system extracts the text and stores it in the database along with paragraph segments. The system then applies TF-IDF to represent the document and uses cosine similarity to compare it with other saved documents in the repository.

**API groups implemented:**
- **Authentication**: register, login, profile retrieval
- **Upload**: document upload with file validation and metadata capture
- **Documents**: list and retrieve with role-aware response filtering
- **Plagiarism**: run analysis, retrieve results with ownership enforcement
- **Admin**: list/delete documents, list/delete users, statistics dashboard

**Deployment readiness:**
- Environment-driven configuration for secrets and service keys
- Stateless backend service suitable for cloud hosting
- Database hosted in managed Supabase PostgreSQL

The administrator module allows the admin to view users, uploaded documents, and similarity results from a centralized dashboard. This helps the institution manage academic documents efficiently and maintain oversight of the plagiarism detection workflow.

### 3.7.3 Testing and Validation

Testing was conducted to check if the system functions work correctly. Each major feature was tested using defined inputs and expected outputs. The testing helped determine whether the system meets the identified requirements. The validation approach is aligned with empirical software engineering work that emphasizes repeatable test design and defect prevention through systematic verification (Cao & Ramesh, 2008).

**Table 7. Testing and Validation Results**

| Test Case | Expected Result | Actual Result | Status |
|-----------|----------------|---------------|--------|
| User Registration | User can create an account with valid credentials. | Account created successfully. | Passed |
| Login with Valid Credentials | User can log in and receive a JWT token. | User logged in successfully. | Passed |
| Login with Invalid Credentials | System rejects incorrect credentials. | Error message displayed, access denied. | Passed |
| Upload Document (Valid File) | User can upload a PDF, DOCX, or TXT file. | File uploaded and text extracted successfully. | Passed |
| Upload Document (Invalid File) | System rejects unsupported file types. | Upload rejected with appropriate error. | Passed |
| Text Extraction | System extracts readable text from uploaded file. | Text extracted and saved successfully. | Passed |
| Similarity Checking | System computes and displays document similarity result. | Similarity score and matched text displayed correctly. | Passed |
| Paragraph-Level Matching | System identifies and flags similar paragraphs. | Flagged paragraphs reported accurately. | Passed |
| Owner Report Access | Document owner can view full similarity report. | Full results returned for owner. | Passed |
| Non-Owner Report Access | Non-owner cannot access another user's full report. | 403 Forbidden response returned correctly. | Passed |
| Admin Dashboard | Admin can view users, documents, and reports. | Records and statistics displayed successfully. | Passed |
| Guest Access Restriction | Guest cannot access upload or analysis features. | Access denied with appropriate restriction. | Passed |
| Logout | User can exit the system and session is cleared. | User logged out, token cleared. | Passed |

Based on the testing results, the system meets the main requirements of the study. It can store documents, extract text, compute similarity, display results, and support administrator monitoring. The system also improves the existing process by centralizing academic documents and making plagiarism checking faster, more organized, and easier to monitor.

**User Interface Design**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                                                                          │
│                                                                          │
│                     INSERT SYSTEM SCREENSHOT HERE                        │
│                                                                          │
│                                                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Plate 1. Landing Page of the System**

Plate 1 shows the landing page of the system where users first arrive before choosing to register or log in. Other screenshots such as the login page, dashboard, document upload page, similarity checking page, similarity result page, and admin dashboard are presented under system outputs in Chapter IV.

---

# CHAPTER IV
# RESULTS AND DISCUSSION

This chapter presents the results of the system development, testing, and evaluation of the proposed Web-Based Academic Repository with Plagiarism Detection. It discusses how the system outputs address the identified problems in document storage, plagiarism checking, and report management.

## System Development Results

The developed system provides a centralized web-based platform where users can upload academic documents and check similarity results through an organized and accessible interface. This directly addresses the identified problems of fragmented file handling, slow originality checking, and lack of centralized document monitoring. The similarity checking module provides measurable results through TF-IDF and cosine similarity, allowing users and administrators to view similarity scores and matched text at both document and paragraph levels.

The system was developed following an Agile SDLC approach, where each module — including user authentication, document upload, text extraction, plagiarism analysis, and admin monitoring — was designed, developed, tested, and refined before integration into the final system. This iterative process ensured that functional requirements were continuously validated against actual system behavior.

## Testing and Evaluation Results

The testing results show that all major functions of the system were performed successfully. User registration, login, document upload, text extraction, similarity checking, admin monitoring, and logout all passed the testing phase, as shown in Table 7. These results indicate that the system meets the main functional requirements identified during the requirements analysis stage.

Role-based access control was verified to work correctly. The system consistently returned HTTP 403 Forbidden responses when non-owners attempted to access restricted reports, and HTTP 401 Unauthorized responses for unauthenticated requests to protected endpoints. Guest users were appropriately restricted from upload and analysis features. Administrator-only endpoints were confirmed inaccessible to registered users.

The plagiarism detection module demonstrated correct similarity scoring behavior. Identical documents returned similarity scores near 1.0, clearly distinct documents returned scores near 0, and partially overlapping documents returned intermediate scores consistent with their shared content volume. Paragraph-level matching accurately flagged individual sections with high overlap, providing more granular feedback than document-level scoring alone.

## System Outputs

The system outputs include uploaded document records, extracted text, similarity scores, matched text, paragraph-level flags, plagiarism reports, and administrator monitoring views. These outputs address the three research questions raised in the study:

1. **Problems in the existing process** were documented through data gathering and addressed through a centralized repository with automated similarity analysis and role-based access control.
2. **Repository improvement** is achieved through centralized document storage with metadata, structured retrieval by user and document, and an administrative dashboard for monitoring submissions and reports.
3. **TF-IDF and cosine similarity for plagiarism detection** are applied through the implemented algorithmic pipeline that produces interpretable similarity scores, matched document references, and flagged paragraph-level content.

The system also supports better monitoring for administrators because uploaded documents and similarity reports can be managed from the admin dashboard. This improves record management and helps strengthen academic integrity in the institution.

---

# CONCLUSION AND RECOMMENDATION

## Conclusion

The Web-Based Academic Repository with Plagiarism Detection Using TF-IDF and Cosine Similarity was designed and developed to improve academic document management and plagiarism checking in academic institutions. The system provides a centralized repository where users can upload documents and view similarity results, while administrators can manage users, documents, and reports.

Based on the testing results, the system was able to perform its main functions successfully, including registration, login, document upload, text extraction, TF-IDF computation, cosine similarity checking at document and paragraph levels, result display, and admin monitoring. Therefore, the system can help make document checking faster, more organized, and easier to monitor.

The system addresses the identified problems of slow plagiarism checking, scattered document storage, difficulty in detecting partial similarities, and limited access control. By combining role-based access control, token-based authentication, and algorithmic similarity analysis into a single web-based platform, the project provides a practical and accessible solution for academic document governance.

## Recommendation

It is recommended that the system be further improved in the following areas:

1. **Advanced Plagiarism Detection**: Future versions may incorporate semantic similarity checking to detect paraphrased and idea-level plagiarism more accurately.
2. **Internet-Based Comparison**: Integration with web search APIs can extend similarity checking beyond the repository corpus to publicly available online content.
3. **Additional File Formats**: Support for additional academic document formats may be added in future iterations.
4. **Multilingual Detection**: Adding multilingual plagiarism detection support would make the system more useful for institutions with diverse language use.
5. **Enhanced Analytics Dashboard**: A more detailed analytics interface with trend reports and per-course monitoring would provide administrators with deeper institutional insights.

These improvements can make the system more useful for academic institutions and serve as a foundation for future research development in academic repository management and text similarity analysis.

---

# REFERENCES

Alzahrani, S. M., Salim, N., & Abraham, A. (2012). Understanding plagiarism linguistic patterns, textual features, and detection methods. *IEEE Transactions on Systems, Man, and Cybernetics, Part C (Applications and Reviews), 42*(2), 133-149. https://doi.org/10.1109/TSMCC.2011.2134847

Cao, L., & Ramesh, B. (2008). Agile requirements engineering practices: An empirical study. *IEEE Software, 25*(1), 60-67. https://doi.org/10.1109/MS.2008.1

Eisa, T. A. E., Salim, N., & Alzahrani, S. (2015). Existing plagiarism detection techniques: A systematic mapping of the scholarly literature. *Online Information Review, 39*(3), 383-400. https://doi.org/10.1108/OIR-12-2014-0315

Fielding, R. T., & Taylor, R. N. (2000). Principled design of the modern Web architecture. In *Proceedings of the 22nd International Conference on Software Engineering (ICSE 2000)* (pp. 407-416). https://doi.org/10.1145/337180.337228

Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT)* (RFC 7519). IETF. https://doi.org/10.17487/RFC7519

Kakkonen, T., & Mozgovoy, M. (2010). Hermetic and web plagiarism detection systems for student essays: An evaluation of the state-of-the-art. *Journal of Educational Computing Research, 42*(2), 135-159. https://doi.org/10.2190/EC.42.2.A

Lynch, C. A. (2003). Institutional repositories: Essential infrastructure for scholarship in the digital age. *ARL Bimonthly Report, 226*. https://www.arl.org/newsltr/226/ir/

Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*. Cambridge University Press. https://doi.org/10.1017/CBO9780511809071

Potthast, M., Stein, B., Barrón-Cedeño, A., & Rosso, P. (2010). An evaluation framework for plagiarism detection. In *Proceedings of the 23rd International Conference on Computational Linguistics (COLING 2010)* (pp. 997-1005).

Salton, G., Wong, A., & Yang, C. S. (1975). A vector space model for automatic indexing. *Communications of the ACM, 18*(11), 613-620. https://doi.org/10.1145/361219.361220

Sandhu, R. S., Coyne, E. J., Feinstein, H. L., & Youman, C. E. (1996). Role-based access control models. *Computer, 29*(2), 38-47. https://doi.org/10.1109/2.485845

Schleimer, S., Wilkerson, D. S., & Aiken, A. (2003). Winnowing: Local algorithms for document fingerprinting. In *Proceedings of the 2003 ACM SIGMOD International Conference on Management of Data* (pp. 76-85). https://doi.org/10.1145/872757.872770

Smith, M., Barton, M., Branschofsky, M., McClellan, G., Walker, J. H., Bass, M., Stuve, D., & Tansley, R. (2003). DSpace: An open source dynamic digital repository. *D-Lib Magazine, 9*(1). https://doi.org/10.1045/january2003-smith

Spärck Jones, K. (1972). A statistical interpretation of term specificity and its application in retrieval. *Journal of Documentation, 28*(1), 11-21. https://doi.org/10.1108/eb026526

Van de Sompel, H., Lagoze, C., Nelson, M., & Warner, S. (2002). *The Open Archives Initiative Protocol for Metadata Harvesting* (Version 2.0). Open Archives Initiative. https://www.openarchives.org/OAI/2.0/openarchivesprotocol.htm
