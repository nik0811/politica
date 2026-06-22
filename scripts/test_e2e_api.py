#!/usr/bin/env python3
"""
E2E Test: Create document via API and verify it's stored
"""

import requests
import json
from datetime import datetime

API_BASE = "http://localhost:8000/api"

def test_create_document():
    """Test creating a document via API"""
    print("🧪 E2E Test: Create Document via API\n")
    
    # Test 1: Health check
    print("1️⃣ Testing API health...")
    response = requests.get(f"{API_BASE.replace('/api', '')}/health")
    assert response.status_code == 200, "API health check failed"
    health = response.json()
    print(f"✅ API Status: {health['status']}")
    print(f"   Services: {health['services']}\n")
    
    # Test 2: Get initial document count
    print("2️⃣ Getting initial document count...")
    response = requests.get(f"{API_BASE}/documents")
    initial_count = len(response.json())
    print(f"✅ Initial documents: {initial_count}\n")
    
    # Test 3: Create a test document
    print("3️⃣ Creating test document...")
    test_doc = {
        "title": "E2E Test Document",
        "content": "This is a test document created by automated E2E testing",
        "url": "https://test.example.com/post/123",
        "platform": "instagram",
        "language": "en",
        "author": "test_user"
    }
    
    response = requests.post(f"{API_BASE}/documents", json=test_doc)
    assert response.status_code in [200, 201], f"Failed to create document: {response.status_code}"
    created_doc = response.json()
    print(f"✅ Document created with ID: {created_doc['id']}")
    print(f"   Title: {created_doc['title']}")
    print(f"   Platform: {created_doc['platform']}\n")
    
    # Test 4: Verify document exists
    print("4️⃣ Verifying document in database...")
    response = requests.get(f"{API_BASE}/documents/{created_doc['id']}")
    assert response.status_code == 200, "Failed to fetch created document"
    fetched_doc = response.json()
    assert fetched_doc['title'] == test_doc['title'], "Title mismatch"
    assert fetched_doc['content'] == test_doc['content'], "Content mismatch"
    print(f"✅ Document verified in database\n")
    
    # Test 5: Search for document
    print("5️⃣ Testing search functionality...")
    response = requests.get(f"{API_BASE}/search?q=E2E+Test")
    assert response.status_code == 200, "Search failed"
    search_results = response.json()
    assert len(search_results['documents']) > 0, "Document not found in search"
    print(f"✅ Document found in search results\n")
    
    # Test 6: Verify final count
    print("6️⃣ Verifying document count increased...")
    response = requests.get(f"{API_BASE}/documents")
    final_count = len(response.json())
    assert final_count == initial_count + 1, "Document count didn't increase"
    print(f"✅ Final documents: {final_count}\n")
    
    print("=" * 50)
    print("🎉 All E2E tests passed!")
    print("=" * 50)
    return created_doc['id']

if __name__ == "__main__":
    try:
        doc_id = test_create_document()
        print(f"\n✅ Test document ID: {doc_id}")
        print("📊 View at: http://localhost:8000/docs")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        exit(1)
