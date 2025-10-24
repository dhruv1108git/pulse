"""
Twilio SMS dispatcher for emergency notifications
"""
import os
from twilio.rest import Client
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class TwilioDispatcher:
    """Handles SMS notifications via Twilio API"""
    
    def __init__(self):
        """Initialize Twilio client with credentials from environment"""
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.from_number = os.getenv('TWILIO_FROM_NUMBER')
        self.demo_phone = os.getenv('DEMO_PHONE_NUMBER', '8355842301')
        
        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.warning('Twilio credentials not configured - SMS dispatch disabled')
            self.client = None
        else:
            try:
                self.client = Client(self.account_sid, self.auth_token)
                logger.info('Twilio dispatcher initialized successfully')
                logger.info(f'Demo phone number: {self.demo_phone}')
                logger.info(f'Twilio from number: {self.from_number}')
            except Exception as e:
                logger.error(f'Failed to initialize Twilio client: {e}')
                self.client = None
    
    def send_emergency_sms(
        self, 
        incident_type: str,
        severity: str,
        location: Dict[str, float],
        address: Optional[str] = None,
        additional_info: Optional[str] = None
    ) -> Dict[str, any]:
        """
        Send emergency SMS notification
        
        Args:
            incident_type: Type of emergency (fire, medical, police, violence)
            severity: Severity level (low, medium, high, critical)
            location: Dict with 'lat' and 'lon' keys
            address: Human-readable address (optional)
            additional_info: Additional context (optional)
        
        Returns:
            Dict with success status and message details
        """
        if not self.client:
            logger.error('Twilio client not initialized - cannot send SMS')
            return {
                'success': False,
                'error': 'SMS service not configured',
                'simulated': True
            }
        
        # Determine emergency service type
        emergency_service = self._get_emergency_service(incident_type)
        
        # Format location
        lat = location.get('lat', 0)
        lon = location.get('lon', 0)
        location_str = f"{lat:.6f}, {lon:.6f}"
        if address:
            location_str = f"{address} ({location_str})"
        
        # Build message
        message_body = self._format_emergency_message(
            incident_type=incident_type,
            severity=severity,
            location_str=location_str,
            emergency_service=emergency_service,
            additional_info=additional_info
        )
        
        try:
            # For demo: send to DEMO_PHONE_NUMBER instead of actual emergency services
            # In production, this would route to appropriate emergency service number
            
            # Use demo_phone as-is if it already has country code, otherwise add +1
            to_number = self.demo_phone if self.demo_phone.startswith('+') else f'+1{self.demo_phone}'
            
            message = self.client.messages.create(
                body=message_body,
                from_=self.from_number,
                to=to_number
            )
            
            logger.info(f'Emergency SMS sent successfully - SID: {message.sid}')
            logger.info(f'Demo dispatch to {to_number} (would be {emergency_service} in production)')
            
            return {
                'success': True,
                'message_sid': message.sid,
                'to': to_number,
                'emergency_service': emergency_service,
                'severity': severity,
                'demo_mode': True,
                'production_service': emergency_service
            }
            
        except Exception as e:
            logger.error(f'Failed to send emergency SMS: {e}', exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'emergency_service': emergency_service
            }
    
    def _get_emergency_service(self, incident_type: str) -> str:
        """Determine which emergency service to contact"""
        incident_type_lower = incident_type.lower()
        
        if 'fire' in incident_type_lower:
            return 'Fire Department'
        elif 'medical' in incident_type_lower or 'health' in incident_type_lower:
            return 'Emergency Medical Services (EMS)'
        elif 'police' in incident_type_lower or 'violence' in incident_type_lower or 'crime' in incident_type_lower:
            return 'Police Department'
        else:
            return '911 Emergency Services'
    
    def _format_emergency_message(
        self,
        incident_type: str,
        severity: str,
        location_str: str,
        emergency_service: str,
        additional_info: Optional[str] = None
    ) -> str:
        """Format emergency notification message"""

        # dummy short message
        message = f"""Incident Type: {incident_type}"""
        
#         message = f"""🚨 EMERGENCY ALERT - {severity.upper()} PRIORITY

# Incident Type: {incident_type}
# Service Required: {emergency_service}

# Location: {location_str}

# Severity: {severity.upper()}
# """
        
        if additional_info:
            message += f"\nAdditional Info: {additional_info}"
        
        message += "\n\nThis is an automated emergency dispatch from Pulse Emergency Response System."
        message += "\n[DEMO MODE: In production, this would be sent to actual emergency services]"
        
        return message


# Global instance
_dispatcher_instance = None

def get_twilio_dispatcher() -> TwilioDispatcher:
    """Get or create global Twilio dispatcher instance"""
    global _dispatcher_instance
    if _dispatcher_instance is None:
        _dispatcher_instance = TwilioDispatcher()
    return _dispatcher_instance

