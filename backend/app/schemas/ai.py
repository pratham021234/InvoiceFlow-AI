from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AISummaryRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    currency: Optional[str] = None


class AISummaryResponse(BaseModel):
    summary: str
    key_insights: List[str]
    recommended_actions: List[str]
    is_mock: bool
    provider: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)


class AIDraftReminderRequest(BaseModel):
    invoice_id: str
    tone: str = Field(default="professional", description="Tone: friendly, professional, firm")
    custom_instructions: Optional[str] = None


class AIDraftReminderResponse(BaseModel):
    invoice_id: str
    invoice_number: str
    client_name: str
    recipient_email: str
    balance_due: str
    currency: str
    due_date: str
    subject: str
    body: str
    tone: str
    is_mock: bool

    model_config = ConfigDict(from_attributes=True)


class AINaturalQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Natural language question about receivables")


class AINaturalQueryResponse(BaseModel):
    query: str
    intent: str
    answer: str
    supporting_data: Dict[str, Any]
    is_mock: bool
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)
