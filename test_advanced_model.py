#!/usr/bin/env python3
"""
Test script to compare different Gemini models for address processing
"""

import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_model(model_name, address):
    """Test a specific model with an address"""
    print(f"\n🧠 Testing Model: {model_name}")
    print("=" * 60)
    
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    model = genai.GenerativeModel(model_name)
    
    prompt = f"""**Objective:** Normalize and improve the following address to make it more complete and standardized.

**Address Information:**
- Raw Address: "{address}"

**Task:**
1. Analyze the provided address and identify what information is missing or unclear.
2. Standardize the format and spelling.
3. Complete missing information where possible (street names, numbers, etc.).
4. Correct any obvious errors or typos.
5. Provide a confidence score (0.0-1.0) indicating how complete and accurate the normalized address is.
6. Explain what improvements were made.

**Output Format:**
Return ONLY a single, minified JSON object with these keys: "normalized_address", "confidence_score", "improvements_made", "missing_info", and "address_quality".

Please normalize this address: "{address}" """
    
    try:
        response = model.generate_content(prompt)
        print(f"✅ Response received")
        print(f"📝 Response: {response.text[:200]}...")
        return response.text
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    # Test address
    test_address = "caleradelsur95@gmail.com casa, virgen del rosario y parana -general artigas, itapua"
    
    print("🔬 COMPARING GEMINI MODELS FOR ADDRESS NORMALIZATION")
    print("=" * 80)
    print(f"Test Address: {test_address}")
    
    # Test different models
    models_to_test = [
        "gemini-1.5-flash",           # Current default
        "gemini-2.5-pro",            # Latest Pro
        "gemini-2.0-flash-thinking-exp",  # Thinking model
        "gemini-2.5-pro-preview-06-05"   # Latest preview
    ]
    
    results = {}
    
    for model in models_to_test:
        result = test_model(model, test_address)
        results[model] = result
    
    print("\n📊 SUMMARY OF RESULTS")
    print("=" * 80)
    for model, result in results.items():
        if result:
            print(f"✅ {model}: Success")
        else:
            print(f"❌ {model}: Failed")

if __name__ == "__main__":
    main()

