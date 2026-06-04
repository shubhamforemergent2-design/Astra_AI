# Astra - AI Knowledge Assistant for Biziverse

## Problem Statement
Astra is an AI-powered Knowledge Assistant for Biziverse users to quickly understand features, learn workflows, resolve common issues, and access training materials.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB (motor async)
- **AI**: OpenAI/Anthropic/Gemini via emergentintegrations (configurable)
- **Auth**: JWT httpOnly cookies + bcrypt + RBAC

## What's Been Implemented

### Iteration 1 (June 4, 2026)
- User Portal: AI chat streaming, conversation history, feedback, tickets, announcements
- Admin Portal: Dashboard, knowledge CRUD, resource management, user management, AI config, announcements, tickets
- JWT auth with brute force protection, 5 RBAC roles

### Iteration 2 (June 4, 2026)
- Password reset flow (forgot password → token → reset)
- Knowledge gap analysis (unanswered questions tracking, accept/reject/bulk delete)
- AI optimization: MongoDB text indexes for 50K+ items, top 3 results only, compact context
- Trained answers: Admin can set verified Q&A pairs (highest priority in AI responses)
- Configurable fallback: Admin sets fallback message, button text, button link when AI has no answer
- Visible "Raise Support Ticket" button on fallback responses
- Natural AI responses (no forced Explanation/Steps/Suggestions headers)
- Ticket delete functionality, latest 100 limit
- "Made with Emergent" badge hidden
- 33/33 backend tests passing, ~95% frontend E2E verified

## Testing
- 33 backend pytest tests (auth, knowledge, chat, admin, trained answers, gap analysis, password reset)
- Frontend E2E: login, register, chat, feedback, tickets, admin CRUD, gap analysis, trained answers, fallback

## Prioritized Backlog
### P1
- [ ] Seed demo knowledge base for immediate testing
- [ ] Conversation management admin page
- [ ] Enhanced analytics with charts

### P2
- [ ] Email-based password reset (instead of token in response)
- [ ] Bulk import knowledge items
- [ ] Mobile responsive improvements
