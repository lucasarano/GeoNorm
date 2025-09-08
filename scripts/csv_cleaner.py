#!/usr/bin/env python3
"""
Paraguay Address Data Cleaner for Google Maps Geocoding
Optimized for accurate geocoding with Paraguay-specific normalization
"""

import pandas as pd
import numpy as np
import re
import argparse
import logging
from typing import Dict, List, Tuple, Optional, Any
from unidecode import unidecode
from rapidfuzz import fuzz
import phonenumbers
from email_validator import validate_email, EmailNotValidError

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# Paraguay canonical data for Maps-aligned correction
DEPARTMENTS = [
    "Asunción", "Central", "Concepción", "San Pedro", "Cordillera", "Guairá", 
    "Caaguazú", "Caazapá", "Itapúa", "Misiones", "Paraguarí", "Alto Paraná", 
    "Ñeembucú", "Amambay", "Canindeyú", "Presidente Hayes", "Alto Paraguay", "Boquerón"
]

CITIES = [
    "Asunción", "Lambaré", "San Lorenzo", "Capiatá", "Fernando de la Mora", 
    "Luque", "Villa Elisa", "Ñemby", "Itauguá", "Limpio", "Areguá", 
    "Mariano Roque Alonso", "Loma Pytã", "Ypané", "Caacupé", "Villarrica", 
    "Encarnación", "Bella Vista", "Hernandarias", "Presidente Franco", 
    "Ciudad del Este", "Pedro Juan Caballero", "Coronel Oviedo", "Caaguazú", 
    "San Antonio", "Carmen del Paraná", "Colonia Independencia", "Santa Rosa del Monday"
]

# Normalization dictionaries (expanded based on real data patterns)
STATE_DICT = {
    "asuncion": "Asunción", "capital": "Asunción", "central": "Central",
    "itapua": "Itapúa", "alto parana": "Alto Paraná", "caaguazu": "Caaguazú",
    "guaira": "Guairá", "amambay": "Amambay", "canindeyu": "Canindeyú",
    "paraguari": "Paraguarí", "presidente hayes": "Presidente Hayes",
    "alto paraguay": "Alto Paraguay", "boqueron": "Boquerón",
    "paraguay": "Asunción",  # when state cell wrongly says "Paraguay"
    # Removed "other" -> "Central" mapping as it's too risky
    "assumption": "Asunción",  # Common typo
    "alto parana": "Alto Paraná",  # Case variation
    "asuncion": "Asunción",  # Case variation
    "caaguazu": "Caaguazú",  # Missing accent
    "guaira": "Guairá",  # Missing accent
    "misiones": "Misiones",
    "concepcion": "Concepción",
    "san pedro": "San Pedro",
    "cordillera": "Cordillera",
    "caazapa": "Caazapá",
    "neembucu": "Ñeembucú",
    "departamento": "Central"  # Generic department reference
}

CITY_DICT = {
    "lambare": "Lambaré", "encarnacion": "Encarnación", "capiata": "Capiatá",
    "san lorenzo": "San Lorenzo", "villa elisa": "Villa Elisa", "nemby": "Ñemby",
    "ypane": "Ypané", "ciudad del este": "Ciudad del Este",
    "hernandarias": "Hernandarias", "presidente franco": "Presidente Franco",
    "guaira": "Villarrica", "independencia": "Colonia Independencia",
    "santa rosa del monday": "Santa Rosa del Monday",
    "coronel oviedo": "Coronel Oviedo", "fernando de la mora": "Fernando de la Mora",
    "luque": "Luque", "itaugua": "Itauguá",
    "limpio": "Limpio", "aregua": "Areguá", "mariano roque alonso": "Mariano Roque Alonso",
    "caacupe": "Caacupé", "villarrica": "Villarrica", "bella vista": "Bella Vista",
    "pedro juan caballero": "Pedro Juan Caballero", "san antonio": "San Antonio",
    "carmen del parana": "Carmen del Paraná",
    "asuncion": "Asunción", "assumption": "Asunción",  # Common typos
    "ciudad nueva": "Ciudad Nueva", "mburicao": "Mburicaó",
    "los cedrales": "Los Cedrales", "obligado": "Obligado",
    "filadelfia": "Filadelfia", "loma plata": "Loma Plata"
}

# City to Department mapping for authority rule
CITY_TO_DEPARTMENT = {
    "Lambaré": "Central", "San Lorenzo": "Central", "Capiatá": "Central",
    "Fernando de la Mora": "Central", "Luque": "Central", "Villa Elisa": "Central",
    "Ñemby": "Central", "Itauguá": "Central", "Limpio": "Central",
    "Areguá": "Central", "Mariano Roque Alonso": "Central",
    "Encarnación": "Itapúa", "Villarrica": "Guairá",
    "Ciudad del Este": "Alto Paraná", "Hernandarias": "Alto Paraná",
    "Presidente Franco": "Alto Paraná", "Pedro Juan Caballero": "Amambay"
}

def load_df(input_file: str) -> pd.DataFrame:
    """Load and validate input CSV file."""
    try:
        df = pd.read_csv(input_file, encoding='utf-8')
        logger.info(f"[1/8] Loaded {len(df)} rows")
        return df
    except Exception as e:
        logger.error(f"Error loading file: {e}")
        raise

def normalize_address(address_parts: List[str]) -> str:
    """
    Normalize address components into a single Google Maps-friendly address line.
    Properly join segments with commas and handle placeholders.
    """
    if not address_parts:
        return ""
    
    # Clean and filter each part separately
    cleaned_parts = []
    for part in address_parts:
        if pd.isna(part) or not str(part).strip():
            continue
            
        part_str = str(part).strip()
        
        # Skip obvious placeholders and noise
        if re.match(r'^(XXX+|0{3,}|N/A|na|undefined|\$address\.address\d+)$', part_str, re.IGNORECASE):
            continue
            
        # Remove email addresses from address parts
        part_str = re.sub(r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b', '', part_str, flags=re.IGNORECASE)
        
        # Remove other noise patterns
        noise_patterns = [
            r'\bCP-\w+\b',   # CP codes
            r'\bCorreo Paraguayo\b',  # Agency labels
            r'\blink de maps\b',  # Map links
            r'\bnumero de telefono\b.*',  # Remove phone number text
            r'\b\d{10,}\b',  # Long tracking numbers
        ]
        
        for pattern in noise_patterns:
            part_str = re.sub(pattern, '', part_str, flags=re.IGNORECASE)
        
        # Clean up extra commas and spaces left by email removal
        part_str = re.sub(r'\s*,\s*,+\s*', ', ', part_str)  # Remove multiple commas
        part_str = re.sub(r'^\s*,\s*', '', part_str)  # Remove leading comma
        part_str = re.sub(r'\s*,\s*$', '', part_str)  # Remove trailing comma
        part_str = re.sub(r'\s+', ' ', part_str)  # Normalize spaces
        
        part_str = part_str.strip()
        if part_str:
            cleaned_parts.append(part_str)
    
    if not cleaned_parts:
        return ""
    
    # Join with commas for better GMaps parsing
    combined = ", ".join(cleaned_parts)
    
    # Standardize abbreviations
    abbrev_map = {
        r'\bAv\.\s*': 'Avenida ',
        r'\bAvda\.\s*': 'Avenida ',
        r'\bGral\.\s*': 'General ',
        r'\bPte\.\s*': 'Presidente ',
        r'\bTte\.\s*': 'Teniente ',
    }
    
    for pattern, replacement in abbrev_map.items():
        combined = re.sub(pattern, replacement, combined, flags=re.IGNORECASE)
    
    # Handle intersections (c/ or y)
    combined = re.sub(r'\bc/\s*', ' y ', combined, flags=re.IGNORECASE)
    combined = re.sub(r'\s+y\s+', ' y ', combined, flags=re.IGNORECASE)
    
    # Normalize kilometer markers
    combined = re.sub(r'\bKm\.?\s*(\d+(?:\.\d+)?)', r'Km \1', combined, flags=re.IGNORECASE)
    
    # Fix common typos
    typo_fixes = {
        r'\byatch\b': 'Yacht',
        r'\bassumption\b': 'Asunción',
        r'\bmecanica\b': 'Mecánica',
        r'\bagricola\b': 'Agrícola',
        r'\bherniandarias\b': 'Hernandarias',
        r'\bmburicao\b': 'Mburicaó',
        r'\bestacionamiento\b': 'Estacionamiento',
        r'\bmetropolitano\b': 'Metropolitano',
        r'\bcondominio\b': 'Condominio',
        r'\bedificio\b': 'Edificio',
        r'\bdepartamento\b': 'Departamento',
        r'\bseminario\b': 'Seminario',
        r'\bcoronel\b': 'Coronel',
        r'\bpresidente\b': 'Presidente',
        r'\bteniente\b': 'Teniente',
        r'\bcapitan\b': 'Capitán'
    }
    
    for pattern, replacement in typo_fixes.items():
        combined = re.sub(pattern, replacement, combined, flags=re.IGNORECASE)
    
    # Clean up spacing and commas
    combined = re.sub(r'\s+', ' ', combined)  # Multiple spaces to single
    combined = re.sub(r',\s*,+', ',', combined)  # Multiple commas
    combined = re.sub(r',\s*$', '', combined)  # Trailing comma
    combined = re.sub(r'^\s*,\s*', '', combined)  # Leading comma
    
    # Remove trailing descriptors only at the end
    combined = re.sub(r',?\s*(casa|informatica|particular|casa particular)\s*$', '', combined, flags=re.IGNORECASE)
    
    return combined.strip()

def fuzzy_match(text: str, candidates: List[str], threshold: int = 88) -> Optional[str]:
    """Find best fuzzy match from candidates list."""
    if not text:
        return None
    
    text_clean = unidecode(text.lower().strip())
    best_match = None
    best_score = 0
    
    for candidate in candidates:
        candidate_clean = unidecode(candidate.lower())
        score = fuzz.ratio(text_clean, candidate_clean)
        if score >= threshold and score > best_score:
            best_score = score
            best_match = candidate
    
    return best_match

def normalize_city_state(city_raw: str, state_raw: str) -> Tuple[str, str]:
    """
    Normalize city and state using dictionaries and fuzzy matching.
    Apply authority rules for known city-department pairings.
    """
    city = ""
    state = ""
    
    # Normalize city
    if pd.notna(city_raw) and str(city_raw).strip():
        city_clean = unidecode(str(city_raw).lower().strip())
        if city_clean in CITY_DICT:
            city = CITY_DICT[city_clean]
        else:
            fuzzy_city = fuzzy_match(str(city_raw), CITIES)
            if fuzzy_city:
                city = fuzzy_city
            else:
                city = str(city_raw).strip().title()
    
    # Normalize state
    if pd.notna(state_raw) and str(state_raw).strip():
        state_clean = unidecode(str(state_raw).lower().strip())
        if state_clean in STATE_DICT:
            state = STATE_DICT[state_clean]
        else:
            fuzzy_state = fuzzy_match(str(state_raw), DEPARTMENTS)
            if fuzzy_state:
                state = fuzzy_state
            else:
                # Check if state_raw is actually a city
                fuzzy_city_from_state = fuzzy_match(str(state_raw), CITIES)
                if fuzzy_city_from_state and not city:
                    city = fuzzy_city_from_state
                    # Infer state from city
                    if city in CITY_TO_DEPARTMENT:
                        state = CITY_TO_DEPARTMENT[city]
                    elif city in ["Asunción"]:
                        state = "Asunción"
                else:
                    state = str(state_raw).strip().title()
    
    # Apply authority rule - override state if we know the city's department
    if city in CITY_TO_DEPARTMENT:
        state = CITY_TO_DEPARTMENT[city]
    
    return city, state

def normalize_phone(phone_raw: str) -> str:
    """
    Normalize phone number to E.164 format for Paraguay.
    Prefer mobile numbers (9xx) over landlines.
    """
    if pd.isna(phone_raw) or not str(phone_raw).strip():
        return ""
    
    # Split on common separators
    phone_candidates = re.split(r'[/,\s]+', str(phone_raw))
    
    valid_phones = []
    for candidate in phone_candidates:
        if not candidate.strip():
            continue
            
        # Clean the candidate
        clean_phone = re.sub(r'[^\d+]', '', candidate.strip())
        
        if not clean_phone or len(clean_phone) < 6:
            continue
            
        # Skip obvious junk
        if re.match(r'^0+$', clean_phone) or len(clean_phone) > 15:
            continue
            
        try:
            # Parse with Paraguay region
            if clean_phone.startswith('+'):
                parsed = phonenumbers.parse(clean_phone, None)
            else:
                # For 10-digit numbers that don't start with 9, try adding +595
                if len(clean_phone) == 10 and not clean_phone.startswith('9'):
                    clean_phone = '+595' + clean_phone
                    parsed = phonenumbers.parse(clean_phone, None)
                else:
                    parsed = phonenumbers.parse(clean_phone, "PY")
            
            if phonenumbers.is_valid_number(parsed):
                formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
                valid_phones.append(formatted)
                
        except phonenumbers.NumberParseException:
            # If phonenumbers fails, try manual formatting for various lengths
            if len(clean_phone) == 10 and clean_phone.isdigit():
                # Assume it's a Paraguay number and add +595
                formatted = '+595' + clean_phone
                valid_phones.append(formatted)
            elif len(clean_phone) == 9 and clean_phone.isdigit():
                # 9-digit number, add +595
                formatted = '+595' + clean_phone
                valid_phones.append(formatted)
            continue
    
    # Also handle the case where phonenumbers rejects valid-looking numbers
    if not valid_phones:
        for candidate in phone_candidates:
            if not candidate.strip():
                continue
                
            clean_phone = re.sub(r'[^\d+]', '', candidate.strip())
            
            if not clean_phone or len(clean_phone) < 6:
                continue
                
            if re.match(r'^0+$', clean_phone) or len(clean_phone) > 15:
                continue
            
            # For any 10-digit number, assume it's Paraguay and add +595
            if len(clean_phone) == 10 and clean_phone.isdigit():
                formatted = '+595' + clean_phone
                valid_phones.append(formatted)
                break  # Only take the first valid-looking number
    
    if not valid_phones:
        return ""
    
    # Prefer mobile numbers (typically start with +5959xx in Paraguay)
    mobile_phones = [p for p in valid_phones if '+5959' in p]
    if mobile_phones:
        return mobile_phones[0]
    
    # Otherwise return first valid
    return valid_phones[0]

def normalize_email(email_raw: str) -> str:
    """
    Normalize and validate email address.
    """
    if pd.isna(email_raw) or not str(email_raw).strip():
        return ""
    
    # Split on common separators and take first valid
    email_candidates = re.split(r'[/,\s]+', str(email_raw).lower().strip())
    
    for candidate in email_candidates:
        if not candidate.strip():
            continue
            
        try:
            validated = validate_email(candidate.strip())
            return validated.email
        except EmailNotValidError:
            continue
    
    return ""

def extract_city_from_address(address: str) -> Optional[str]:
    """
    Extract city name from address if present.
    """
    if not address:
        return None
    
    address_lower = unidecode(address.lower())
    
    # Check for cities in the address
    for city in CITIES:
        city_lower = unidecode(city.lower())
        if city_lower in address_lower:
            return city
    
    # Check dictionary keys as well
    for key, value in CITY_DICT.items():
        if key in address_lower:
            return value
    
    return None

def validate_and_dedupe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Validate rows: keep if has address OR (city+state) AND has phone OR email.
    Remove exact duplicates.
    """
    initial_count = len(df)
    
    # Fill empty values with empty strings to avoid NaN issues
    df = df.fillna('')
    
    # Validation: must have location info and contact info
    valid_mask = (
        # Has location: address OR (city and state)
        (df['Address'].str.strip() != '') | 
        ((df['City'].str.strip() != '') & (df['State'].str.strip() != ''))
    ) & (
        # Has contact: phone OR email
        (df['Phone'].str.strip() != '') | (df['Email'].str.strip() != '')
    )
    
    df_valid = df[valid_mask].copy()
    invalid_dropped = initial_count - len(df_valid)
    
    # Remove exact duplicates
    df_deduped = df_valid.drop_duplicates(subset=['Address', 'City', 'State', 'Phone', 'Email'])
    duplicates_dropped = len(df_valid) - len(df_deduped)
    
    logger.info(f"[6/8] Dropped {invalid_dropped} invalid rows; removed {duplicates_dropped} duplicates")
    
    return df_deduped

def build_google_helpers(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build internal Google Maps query helpers for QA.
    """
    df = df.copy()
    
    def build_query(row):
        parts = []
        if pd.notna(row['Address']) and row['Address']:
            parts.append(row['Address'])
        if pd.notna(row['City']) and row['City']:
            parts.append(row['City'])
        if pd.notna(row['State']) and row['State']:
            parts.append(row['State'])
        parts.append('Paraguay')
        return ', '.join(parts)
    
    def build_components(row):
        components = {"country": "PY"}
        if pd.notna(row['City']) and row['City']:
            components["locality"] = row['City']
        if pd.notna(row['State']) and row['State']:
            components["administrative_area"] = row['State']
        return components
    
    df['google_query'] = df.apply(build_query, axis=1)
    df['google_components'] = df.apply(build_components, axis=1)
    
    return df

def save_df(df: pd.DataFrame, output_file: str) -> None:
    """Save cleaned dataframe to CSV."""
    output_cols = ['Address', 'City', 'State', 'Phone', 'Email']
    df[output_cols].to_csv(output_file, index=False, encoding='utf-8')
    logger.info(f"[8/8] Wrote {len(df)} rows to {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Clean Paraguay address data for Google Maps geocoding')
    parser.add_argument('--in', dest='input_file', required=True, help='Input CSV file')
    parser.add_argument('--out', dest='output_file', required=True, help='Output CSV file')
    
    args = parser.parse_args()
    
    # Load data
    df = load_df(args.input_file)
    
    # Extract and normalize addresses
    logger.info("[2/8] Normalized Address strings (Google-friendly)")
    address_cols = ['Buyer Address1', 'Buyer Address1 Number', 'Buyer Address2', 'Buyer Address3']
    existing_cols = [col for col in address_cols if col in df.columns]
    
    if existing_cols:
        df['Address'] = df[existing_cols].apply(
            lambda row: normalize_address([row[col] for col in existing_cols]), axis=1
        )
    else:
        df['Address'] = ""
    
    # Normalize city and state using the proper function with authority rules
    logger.info("[3/8] Corrected City/State (locality/admin_area_level_1)")
    city_col = 'Buyer City' if 'Buyer City' in df.columns else None
    state_col = 'Buyer State' if 'Buyer State' in df.columns else None
    
    # Apply proper normalization with authority rules
    if city_col and state_col:
        normalized = df.apply(
            lambda row: normalize_city_state(row[city_col], row[state_col]), axis=1
        )
        df['City'] = [x[0] for x in normalized]
        df['State'] = [x[1] for x in normalized]
    else:
        df['City'] = df.get(city_col, "") if city_col else ""
        df['State'] = df.get(state_col, "") if state_col else ""
    
    # Extract city from address if city is empty
    for idx, row in df.iterrows():
        if not row['City'] and row['Address']:
            extracted_city = extract_city_from_address(row['Address'])
            if extracted_city:
                # Re-normalize with the extracted city
                normalized_city, normalized_state = normalize_city_state(extracted_city, row['State'])
                df.at[idx, 'City'] = normalized_city
                if not row['State']:  # Only update state if it was empty
                    df.at[idx, 'State'] = normalized_state
    
    # Normalize phone
    logger.info("[4/8] Normalized Phones (E.164, PY)")
    phone_col = 'Buyer Phone' if 'Buyer Phone' in df.columns else None
    if phone_col:
        df['Phone'] = df[phone_col].apply(normalize_phone)
    else:
        df['Phone'] = ""
    
    # Normalize email
    logger.info("[5/8] Validated Emails")
    email_col = 'Buyer Email' if 'Buyer Email' in df.columns else None
    if email_col:
        df['Email'] = df[email_col].apply(normalize_email)
    else:
        df['Email'] = ""
    
    # Validate and dedupe
    df_clean = validate_and_dedupe(df)
    
    # Build Google helpers for QA
    df_with_helpers = build_google_helpers(df_clean)
    
    # Print sample queries for inspection
    logger.info("[7/8] Sample Google queries/components printed")
    print("\n=== SAMPLE GOOGLE MAPS QUERIES (First 5) ===")
    for i, row in df_with_helpers.head(5).iterrows():
        print(f"Row {i+1}:")
        print(f"  Query: {row['google_query']}")
        print(f"  Components: {row['google_components']}")
        print()
    
    # Save final output
    save_df(df_clean, args.output_file)
    
    print(f"\n=== FIRST 5 CLEANED ROWS ===")
    print(df_clean[['Address', 'City', 'State', 'Phone', 'Email']].head(5).to_string(index=False))

if __name__ == "__main__":
    main()
