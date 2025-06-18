"""
Contract type and clause type utilities for AI services.
Extracted from ai_service.py for better maintainability.
"""
from typing import List


def get_relevant_clause_types(contract_type) -> List:
    """Get relevant clause types for a specific contract type."""
    
    # Import here to avoid dependency issues during import
    try:
        from models.common import ClauseType
        from clauseiq_types.common import ContractType
    except ImportError:
        # Return empty list if dependencies not available
        return []
    """Get relevant clause types for a specific contract type."""
    
    # Universal clauses applicable to most contracts
    universal_clauses = [
        ClauseType.CONFIDENTIALITY,
        ClauseType.INTELLECTUAL_PROPERTY,
        ClauseType.DISPUTE_RESOLUTION,
        ClauseType.LIABILITY,
        ClauseType.INDEMNIFICATION,
        ClauseType.FORCE_MAJEURE,
        ClauseType.GOVERNING_LAW,
        ClauseType.ASSIGNMENT_RIGHTS,
        ClauseType.AMENDMENT_PROCEDURES,
        ClauseType.NOTICES,
        ClauseType.ENTIRE_AGREEMENT,
        ClauseType.SEVERABILITY,
        ClauseType.GENERAL
    ]
    
    # Contract-specific clauses
    contract_specific = {
        ContractType.EMPLOYMENT: [
            ClauseType.COMPENSATION, ClauseType.TERMINATION, ClauseType.NON_COMPETE,
            ClauseType.BENEFITS, ClauseType.WORKING_CONDITIONS, ClauseType.PROBATION,
            ClauseType.SEVERANCE, ClauseType.OVERTIME_PAY, ClauseType.VACATION_POLICY,
            ClauseType.STOCK_OPTIONS, ClauseType.BACKGROUND_CHECK
        ],
        ContractType.NDA: [
            ClauseType.DISCLOSURE_OBLIGATIONS, ClauseType.RETURN_OF_INFORMATION,
            ClauseType.DEFINITION_OF_CONFIDENTIAL, ClauseType.EXCEPTIONS_TO_CONFIDENTIALITY,
            ClauseType.DURATION_OF_OBLIGATIONS
        ],
        ContractType.SERVICE_AGREEMENT: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.SERVICE_LEVEL,
            ClauseType.WARRANTIES, ClauseType.SERVICE_CREDITS,
            ClauseType.DATA_PROTECTION, ClauseType.THIRD_PARTY_SERVICES,
            ClauseType.CHANGE_MANAGEMENT, ClauseType.TERMINATION
        ],
        ContractType.CONSULTING: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.SERVICE_LEVEL,
            ClauseType.WARRANTIES, ClauseType.TERMINATION
        ],
        ContractType.CONTRACTOR: [
            ClauseType.SCOPE_OF_WORK, ClauseType.DELIVERABLES, 
            ClauseType.PAYMENT_TERMS, ClauseType.TERMINATION,
            ClauseType.WARRANTIES
        ],
        ContractType.LEASE: [
            ClauseType.RENT, ClauseType.SECURITY_DEPOSIT, 
            ClauseType.MAINTENANCE, ClauseType.USE_RESTRICTIONS,
            ClauseType.UTILITIES, ClauseType.PARKING, ClauseType.PET_POLICY,
            ClauseType.SUBLETTING, ClauseType.EARLY_TERMINATION,
            ClauseType.RENEWAL_OPTIONS, ClauseType.PROPERTY_INSPECTION
        ],
        ContractType.PURCHASE: [
            ClauseType.PAYMENT_TERMS, ClauseType.DELIVERY_TERMS,
            ClauseType.INSPECTION_RIGHTS, ClauseType.TITLE_TRANSFER,
            ClauseType.RISK_OF_LOSS, ClauseType.RETURNS_REFUNDS,
            ClauseType.WARRANTIES, ClauseType.TERMINATION
        ],
        ContractType.PARTNERSHIP: [
            ClauseType.PAYMENT_TERMS, ClauseType.TERMINATION,
            ClauseType.SCOPE_OF_WORK, ClauseType.LIABILITY,
            ClauseType.DISPUTE_RESOLUTION, ClauseType.ASSIGNMENT_RIGHTS
        ],
        ContractType.LICENSE: [
            ClauseType.USE_RESTRICTIONS, ClauseType.PAYMENT_TERMS,
            ClauseType.TERMINATION, ClauseType.WARRANTIES,
            ClauseType.DURATION_OF_OBLIGATIONS, ClauseType.ASSIGNMENT_RIGHTS
        ]
    }
    
    specific_clauses = contract_specific.get(contract_type, [])
    return specific_clauses + universal_clauses


def get_contract_type_mapping() -> dict:
    """Get mapping from string responses to ContractType enum values."""
    try:
        from clauseiq_types.common import ContractType
        return {
            "employment": ContractType.EMPLOYMENT,
            "nda": ContractType.NDA,
            "service_agreement": ContractType.SERVICE_AGREEMENT,
            "lease": ContractType.LEASE,
            "purchase": ContractType.PURCHASE,
            "partnership": ContractType.PARTNERSHIP,
            "license": ContractType.LICENSE,
            "consulting": ContractType.CONSULTING,
            "contractor": ContractType.CONTRACTOR,
            "other": ContractType.OTHER
        }
    except ImportError:
        # Return string mapping if enum not available
        return {
            "employment": "employment",
            "nda": "nda", 
            "service_agreement": "service_agreement",
            "lease": "lease",
            "purchase": "purchase",
            "partnership": "partnership",
            "license": "license",
            "consulting": "consulting",
            "contractor": "contractor",
            "other": "other"
        }
