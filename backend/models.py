from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from typing import Optional, List, Annotated
from datetime import datetime, timezone
from bson import ObjectId


PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    id: Optional[PyObjectId] = Field(None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        return cls(**doc)

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in data and data["_id"]:
            data["_id"] = ObjectId(data["_id"])
        else:
            data.pop("_id", None)
        return data


# ── User ──
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "end_user"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool = True
    created_at: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str


# ── Knowledge Module ──
class ModuleCreate(BaseModel):
    name: str
    description: str = ""

class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ── Topic ──
class TopicCreate(BaseModel):
    name: str
    description: str = ""
    module_id: str

class TopicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    module_id: Optional[str] = None


# ── Knowledge Item ──
class KnowledgeItemCreate(BaseModel):
    title: str
    answer_type: str = "how_to"
    question: str
    explanation: str = ""
    steps: List[str] = []
    suggestions: List[str] = []
    keywords: List[str] = []
    topic_id: str
    module_id: str
    resource_ids: List[str] = []

class KnowledgeItemUpdate(BaseModel):
    title: Optional[str] = None
    answer_type: Optional[str] = None
    question: Optional[str] = None
    explanation: Optional[str] = None
    steps: Optional[List[str]] = None
    suggestions: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    topic_id: Optional[str] = None
    module_id: Optional[str] = None
    resource_ids: Optional[List[str]] = None


# ── Resource ──
class ResourceCreate(BaseModel):
    title: str
    description: str = ""
    resource_type: str = "document"
    url: str = ""
    duration: Optional[str] = None
    timestamp: Optional[str] = None

class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    resource_type: Optional[str] = None
    url: Optional[str] = None
    duration: Optional[str] = None
    timestamp: Optional[str] = None


# ── Conversation ──
class ConversationCreate(BaseModel):
    title: str = "New Conversation"


# ── Message ──
class MessageCreate(BaseModel):
    content: str


# ── Feedback ──
class FeedbackCreate(BaseModel):
    message_id: str
    conversation_id: str
    is_helpful: bool
    comment: Optional[str] = None


# ── Ticket ──
class TicketCreate(BaseModel):
    question: str
    ai_response: str = ""
    conversation_id: Optional[str] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None


# ── Announcement ──
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    is_active: bool = True

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None


# ── AI Config ──
class AIConfigUpdate(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    fallback_message: Optional[str] = None
    fallback_button_text: Optional[str] = None
    fallback_button_link: Optional[str] = None
    show_raise_ticket: Optional[bool] = None
    enable_suggestions: Optional[bool] = None
    max_suggestions: Optional[int] = None
    confidence_threshold: Optional[float] = None


# ── Password Reset ──
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── Trained Answers ──
class TrainedAnswerCreate(BaseModel):
    question_pattern: str
    answer: str
    keywords: List[str] = []

class TrainedAnswerUpdate(BaseModel):
    question_pattern: Optional[str] = None
    answer: Optional[str] = None
    keywords: Optional[List[str]] = None
