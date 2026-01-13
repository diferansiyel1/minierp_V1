from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List
from pathlib import Path
import os
from jinja2 import Environment, FileSystemLoader

# Mock credentials for dev, normally from env vars
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "user@example.com"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "password"),
    MAIL_FROM = os.getenv("MAIL_FROM", "info@pikolab.com"),
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True,
    TEMPLATE_FOLDER = Path(__file__).parent.parent / 'templates'
)

async def send_email(subject: str, recipients: List[str], template_name: str, template_body: dict):
    """
    Send an email using a Jinja2 template.
    """
    message = MessageSchema(
        subject=subject,
        recipients=recipients,
        template_body=template_body,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    
    try:
        if os.getenv("MAIL_USERNAME") == "user@example.com":
             print(f"Mock Email Sent to {recipients}: Subject: {subject}")
             return True

        await fm.send_message(message, template_name=template_name)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
