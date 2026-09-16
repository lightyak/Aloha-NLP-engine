Build a **standalone, modular, configuration-driven Multilingual Conversational NLU Engine** for SIH 2026 Problem Statement 26090.

The engine will be integrated into both:

- a mobile application
- a web application

Both clients must communicate with the same backend NLU engine through APIs.

Use **JavaScript/TypeScript only**. Do NOT use Python.

---

# 0. VERY IMPORTANT — DEVELOPMENT AGENT BEHAVIOR

You are the coding/development agent responsible for building this project.

Before implementing anything, inspect the existing project and understand:

- current files
- existing architecture
- installed dependencies
- package manager
- environment files
- database configuration
- existing APIs
- existing code
- existing documentation
- existing frontend/backend boundaries

Do NOT assume that the project is empty.

Do NOT unnecessarily replace or recreate existing code.

---

# 1. ASK FOR REQUIRED INFORMATION

If you need information that is unavailable, **ask me for it before continuing**.

Examples include:

- database URL
- database username/password
- API keys
- LLM provider
- LLM API key
- model name
- Speech-to-Text provider
- STT API key
- authentication configuration
- cloud/storage credentials
- deployment information
- domain
- port requirements
- third-party service credentials
- required SIH-provided APIs
- existing project configuration
- existing database schema

Do NOT:

- invent credentials
- invent API keys
- invent database URLs
- invent provider accounts
- assume I have a particular service
- hard-code secrets
- silently substitute a random provider

If something is required, explicitly ask for it.

---

# 2. ASK ONLY WHEN NECESSARY

Do not ask me a huge list of questions at the beginning.

Determine what is required for the **current implementation phase**.

For example:

If Phase 1 only requires a database connection, ask for the database URL.

Do not ask for an STT API key until the STT phase actually begins.

Use this format when requesting information:

```text
Required now:
1. DATABASE_URL
2. ...

Why:
- DATABASE_URL is required to initialize the database connection.

Optional now:
- ...

Can proceed without:
- ...
```

Keep the request concise.

If a sensible local development option can be used without external credentials, you may use it, but tell me what you chose.

---

# 3. NEVER EXPOSE OR HARD-CODE SECRETS

All credentials must use environment variables.

For example:

```text
DATABASE_URL=
LLM_API_KEY=
STT_API_KEY=
JWT_SECRET=
```

Create:

```text
.env.example
```

but NEVER put real credentials inside it.

Never commit `.env` to Git.

Ensure `.gitignore` protects secrets.

---

# 4. DO NOT GUESS PROVIDERS

If multiple providers are possible, ask me when the choice materially affects implementation.

For example:

```text
LLM:
- Provider A
- Provider B
- Provider C
```

If I have not selected one and the architecture can remain provider-independent, implement the abstraction first.

Ask for the actual provider/API key only when integration is required.

---

# 5. OPTIMIZE YOUR OWN TOKEN USAGE

This requirement applies to **you as the coding AI**, NOT to the runtime NLU engine.

While developing the project:

- inspect before modifying
- reuse existing code
- don't repeatedly output unchanged files
- don't regenerate entire files unnecessarily
- don't repeat architecture explanations
- don't generate unnecessary boilerplate
- don't create unnecessary files
- don't install unnecessary packages
- make small targeted changes
- test changes before proceeding
- keep responses concise
- preserve project context
- do not restart implementation unnecessarily

When modifying a file, show only the relevant change unless the entire file is genuinely required.

Prioritize:

**working implementation > lengthy explanation**

---

# 6. CORE OBJECTIVE

Build an AI-powered conversational NLU engine that allows artisans to describe products naturally using voice or text.

Example:

> "ఇది కొండపల్లి బొమ్మ. చెక్కతో చేశాను. మూడు రోజులు పట్టింది. 800 రూపాయలు కావాలి."

The system should understand the meaning and convert the information into structured product data.

Example:

```json
{
  "product_name": "Kondapalli Toy",
  "craft_type": "Kondapalli Craft",
  "material": ["Wood"],
  "production_time": "3 days",
  "price": 800,
  "currency": "INR"
}
```

This example is only for demonstrating behavior.

Do NOT hard-code the engine around Kondapalli, Telugu, toys, wood, or these exact fields.

---

# 7. NO HARD-CODING

Nothing that represents application knowledge should be hard-coded.

Do NOT hard-code:

- languages
- crafts
- categories
- product fields
- entities
- intents
- validation rules
- normalization rules
- required fields
- optional fields
- units
- currencies
- confidence thresholds
- conversation states
- question templates
- AI prompts
- model names
- providers

Use:

- configuration
- database
- schemas
- environment variables
- provider abstractions

where appropriate.

The core NLU engine must remain generic.

---

# 8. CONFIGURATION-DRIVEN ARCHITECTURE

Create a central configuration architecture.

Possible structure:

```text
config/
    app
    database
    providers
    languages
    schemas
    intents
    entities
    ontology
    validation
    prompts
```

The exact implementation can use configuration files, database records, or a combination.

Choose the simplest architecture that provides genuine dynamic behavior.

---

# 9. DYNAMIC PRODUCT SCHEMA

Product attributes must not be hard-coded.

Create a configurable schema system.

Example:

```json
{
  "name": "price",
  "type": "number",
  "required": true
}
```

The engine should dynamically understand available product attributes.

Adding a new attribute should not require changing NLU core code.

---

# 10. DYNAMIC INTENTS

Create a configurable intent system.

Possible initial intents:

```text
CREATE_PRODUCT
UPDATE_PRODUCT
CORRECT_INFORMATION
SET_PRICE
SET_QUANTITY
ADD_ATTRIBUTE
CONFIRM
REJECT
PUBLISH_PRODUCT
CHECK_PRODUCT
```

These are examples, NOT a fixed architecture.

New intents should be addable through configuration.

Avoid large hard-coded switch/case statements.

---

# 11. DYNAMIC ENTITIES

Entity definitions should come from the product schema/configuration.

The system should be able to extract arbitrary configured attributes.

Do not create separate hard-coded extraction functions for:

```text
extractPrice()
extractColor()
extractMaterial()
...
```

unless there is a strong deterministic reason.

Use generic extraction based on schema/configuration.

---

# 12. MULTILINGUAL ARCHITECTURE

The engine must support multilingual interaction.

Do not hard-code the engine to a fixed set of languages.

Language support should be configurable and dependent on the selected STT/LLM providers.

Support:

- multilingual text
- multilingual voice
- language detection
- code-switching
- local-language numbers
- local-language expressions

Example:

> "ఇది cotton saree, price 2500 rupees."

should be understandable.

---

# 13. SPEECH-TO-TEXT ABSTRACTION

Create:

```text
SpeechToTextProvider
```

The implementation must be replaceable.

Do not tightly couple the engine to one provider.

If an STT provider is required:

1. Ask me which provider I want if the choice matters.
2. Ask for the API key only when needed.
3. Store credentials through environment variables.
4. Never hard-code credentials.

---

# 14. LLM ABSTRACTION

Create:

```text
LLMProvider
```

The NLU engine must not depend directly on one vendor.

Provider-specific implementation should remain isolated.

If no provider has been selected:

- implement the abstraction/interface first if possible
- ask me to select a provider before implementing the provider-specific integration

Do not invent a provider or API key.

---

# 15. NLU + LLM

The product is an **NLU engine**, not simply an LLM wrapper.

Use the LLM for semantic understanding where appropriate.

Use deterministic processing for deterministic operations.

Architecture:

```text
Input
 ↓
Preprocessing
 ↓
NLU
 ├── deterministic processing
 ├── configuration
 ├── context/state
 └── LLM semantic understanding
 ↓
Validation
 ↓
Structured Product
```

---

# 16. CONVERSATION STATE

Maintain structured conversation state.

Example:

```json
{
  "session_id": "...",
  "intent": "...",
  "product": {},
  "missing_fields": [],
  "language": "..."
}
```

Do not treat every message as a completely independent request.

Support:

> "This is a wooden toy."

then:

> "It is blue."

then:

> "It costs 800."

The information should be merged into the same product draft.

---

# 17. NATURAL CORRECTIONS

Support:

> "Actually, the price is 900."

> "No, it is cotton, not silk."

> "Change the quantity to 10."

The system should update the current product state rather than creating a new product.

---

# 18. MISSING INFORMATION

Required fields must be determined dynamically from:

```text
schema
+
category configuration
+
current product state
```

Do not hard-code questions such as:

> Always ask quantity.

Instead ask only what is actually required.

---

# 19. VALIDATION ENGINE

Create generic configurable validation.

Support rules such as:

```text
required
type
min
max
range
regex
enum
dependency
```

Rules must not be scattered throughout the application code.

---

# 20. NORMALIZATION ENGINE

Create configurable normalization.

Support:

- aliases
- synonyms
- units
- currencies
- language variants
- craft names
- category mappings

Do not hard-code these mappings throughout the application.

---

# 21. CRAFT ONTOLOGY

Create a configurable ontology for:

- crafts
- categories
- materials
- techniques
- regions
- aliases
- local names
- related products

The initial dataset may be small, but the architecture must support expansion.

---

# 22. CONFIDENCE AND VALIDATION

The AI must not blindly determine product information.

Extracted information should go through validation.

Uncertain information should be confirmed.

The exact confidence behavior should be configurable rather than embedded in code.

---

# 23. CATALOG GENERATION

After validation, generate:

- product title
- short description
- detailed description
- tags
- search keywords

Generated content must be based only on validated product data.

The LLM must not invent factual attributes.

---

# 24. API

Create a clean REST API.

At minimum:

```text
POST /api/v1/sessions
POST /api/v1/sessions/:id/message
POST /api/v1/sessions/:id/audio
GET  /api/v1/sessions/:id
POST /api/v1/products/validate
POST /api/v1/products/catalog
POST /api/v1/products/publish
GET  /api/v1/health
```

The exact API can be improved if technically justified.

---

# 25. FRONTEND INDEPENDENCE

The engine must work independently from:

- React
- React Native
- Flutter
- Android
- iOS

Any client capable of making HTTP requests should be able to use it.

---

# 26. DATABASE

Use PostgreSQL or MongoDB depending on the project requirements.

Do not assume credentials.

If a database is required and no connection information exists:

**ASK ME FOR THE DATABASE URL BEFORE attempting a real database integration.**

Create the database abstraction/repository layer so the rest of the application does not directly depend on database-specific implementation details.

---

# 27. ENVIRONMENT CONFIGURATION

Create:

```text
.env.example
```

Include placeholders such as:

```text
NODE_ENV=
PORT=
DATABASE_URL=

LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=

STT_PROVIDER=
STT_API_KEY=

JWT_SECRET=
```

Only include variables that are actually required.

Do not fill them with fake values.

Validate required environment variables when the application starts.

The application should provide a clear error such as:

```text
Missing required environment variable: DATABASE_URL
```

instead of failing mysteriously.

---

# 28. DEPENDENCY MANAGEMENT

Before installing a dependency:

1. Check whether an existing dependency can already perform the task.
2. Avoid duplicate libraries.
3. Prefer lightweight, maintained packages.
4. Install only what is necessary.

Do not add a library simply because it is popular.

---

# 29. ERROR HANDLING

Handle:

- missing environment variables
- invalid configuration
- database failure
- STT failure
- LLM failure
- malformed AI output
- validation errors
- unsupported language
- invalid audio
- authentication errors
- network errors

Errors must be understandable and actionable.

---

# 30. SECURITY

Implement:

- environment-based secrets
- input validation
- authentication where required
- authorization
- rate limiting
- file validation
- upload limits
- secure database access
- audit logging
- safe error responses

Never expose API keys in responses.

Never log secrets.

---

# 31. PRIVACY

Minimize stored user data.

Do not permanently store raw audio unless explicitly required.

Use configurable retention policies.

Do not send unnecessary personal information to external AI providers.

---

# 32. TESTING

Create tests for:

- multilingual input
- text input
- audio processing
- intent detection
- entity extraction
- context
- corrections
- missing fields
- validation
- normalization
- malformed AI output
- provider failure
- configuration changes

Include tests proving that adding a field through configuration works without changing the NLU core.

---

# 33. API DOCUMENTATION

Provide:

- OpenAPI specification
- Swagger UI
- sample requests
- sample responses
- error responses

Create Postman collection if useful.

---

# 34. PROJECT STRUCTURE

Use a clean modular structure such as:

```text
src/
  api/
    routes/
    controllers/

  core/
    nlu/
    dialogue/
    state/
    validation/
    normalization/

  providers/
    llm/
    stt/

  config/

  schemas/

  ontology/

  prompts/

  models/

  repositories/

  middleware/

  utils/

  tests/

  app.ts
  server.ts
```

Adapt this structure to the existing project rather than blindly creating it.

---

# 35. DEVELOPMENT PHASES

Build incrementally.

## Phase 1 — Foundation

Implement:

- project setup
- configuration
- environment handling
- API
- database abstraction
- health check
- error handling

Before database integration, ask me for the database URL if one is required.

---

## Phase 2 — Dynamic Schema

Implement:

- product schema
- dynamic fields
- validation configuration
- ontology foundation

---

## Phase 3 — Text NLU

Implement:

- intent detection
- entity extraction
- structured output
- validation

Ask for the LLM provider/API key if required.

---

## Phase 4 — Conversation

Implement:

- sessions
- state
- missing fields
- corrections
- confirmations

---

## Phase 5 — Voice

Implement:

- STT abstraction
- selected STT provider
- multilingual audio processing

Ask me for the STT provider/API key at this stage if necessary.

---

## Phase 6 — Catalog

Implement:

- title generation
- descriptions
- tags
- search keywords

---

## Phase 7 — Testing

Implement:

- unit tests
- integration tests
- multilingual tests
- configuration tests

---

## Phase 8 — Documentation

Complete:

- README
- Swagger
- API examples
- environment setup
- architecture documentation

---

# 36. INFORMATION REQUEST PROTOCOL

Whenever you encounter a missing external dependency or credential, STOP before implementing that dependent part and ask me.

Use this format:

```text
I need the following before continuing:

1. [Information]
   Why: [short reason]

2. [Information]
   Why: [short reason]

Optional:
- [Information]

You can provide them as:
KEY=value
```

Do not ask for information that is not needed yet.

Do not ask me to provide information that can safely be discovered from the existing project.

First inspect the project.

---

# 37. IF I DON'T HAVE THE INFORMATION

If I tell you that I don't have a required API/database/service yet:

Do not invent one.

Instead:

1. Explain the minimum viable alternative.
2. Use a local/mock implementation ONLY if appropriate.
3. Clearly mark it as development/test-only.
4. Keep the provider abstraction intact.
5. Make replacement with the real service straightforward.

Mocks must never silently become production implementations.

---

# 38. DO NOT FABRICATE FUNCTIONALITY

Never pretend an AI provider is connected when it isn't.

Never create fake API responses and present them as real AI processing.

Never hard-code example outputs into production logic.

Mocks are allowed only in tests or explicitly marked development mode.

---

# 39. DEMO

The final system should support:

```text
Artisan
   ↓
Voice/Text
   ↓
STT
   ↓
Language Detection
   ↓
NLU
   ↓
Entity Extraction
   ↓
Product State
   ↓
Validation
   ↓
Missing Information
   ↓
Confirmation
   ↓
Catalog Generation
   ↓
Structured Product API
   ↓
Mobile/Web Application
```

---

# 40. FINAL PRODUCT DEFINITION

The finished system should be:

> **A configuration-driven multilingual conversational NLU engine that converts natural artisan communication into validated structured product data and exposes the capability through reusable APIs for mobile and web applications.**

It should NOT be:

- a simple chatbot
- a hard-coded form
- an LLM wrapper
- a Telugu-only solution
- a frontend-specific implementation
- a collection of hard-coded commands

---

# 41. START NOW

Do NOT generate the entire project immediately.

First:

1. Inspect the existing project.
2. Identify the current technology stack.
3. Identify what already exists.
4. Identify what is missing.
5. Determine what information/credentials are required for Phase 1.
6. Ask me ONLY for information that is actually required.
7. Do not start dependent implementation until the required information is available.

If no external information is required, proceed with Phase 1.

While working, keep your own responses concise and avoid wasting context/tokens on repeated explanations or unchanged code.

**Never guess credentials, API keys, database URLs, providers, or other project-specific information. Ask me when needed.**