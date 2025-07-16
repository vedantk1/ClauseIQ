#!/usr/bin/env python3
"""
Check Pinecone document count for ClauseIQ.
"""
import asyncio
import os
import sys
from typing import Dict, Any

# Add backend to path dynamically
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.append(backend_path)

from services.pinecone_vector_service import get_pinecone_vector_service
from config.logging import get_foundational_logger

logger = get_foundational_logger("pinecone_check")

async def check_pinecone_documents():
    """Check how many documents are stored in Pinecone."""
    try:
        print("🔍 Checking Pinecone document storage...")
        
        # Get Pinecone service
        pinecone_service = get_pinecone_vector_service()
        
        # Initialize service
        if not await pinecone_service.initialize():
            print("❌ Failed to initialize Pinecone service")
            return
        
        print("✅ Pinecone service initialized successfully")
        
        # Get storage usage (which includes vector counts)
        storage_info = await pinecone_service.get_total_storage_usage()
        
        print("\n📊 Pinecone Storage Information:")
        print(f"   Index Name: {pinecone_service.index_name}")
        print(f"   Total Vectors: {storage_info.get('total_vectors', 0):,}")
        print(f"   Estimated Storage: {storage_info.get('estimated_storage_mb', 0)} MB")
        print(f"   Usage: {storage_info.get('usage_percentage', 0)}% of free tier")
        
        # Get namespace information if available
        namespaces = storage_info.get('namespaces', {})
        if namespaces:
            print("\n👥 Namespace Breakdown:")
            total_docs = 0
            for namespace, info in namespaces.items():
                try:
                    # Handle different Pinecone namespace object formats
                    if hasattr(info, 'vector_count'):
                        count = int(info.vector_count)
                    elif isinstance(info, dict):
                        count = info.get('vector_count', 0)
                    else:
                        count = int(info) if info else 0
                    
                    print(f"   {namespace}: {count} vectors")
                    if namespace.startswith('user_'):
                        # Estimate documents (assuming avg 10 chunks per document)
                        estimated_docs = max(1, count // 10) if count > 0 else 0
                        total_docs += estimated_docs
                        print(f"     └── Estimated documents: ~{estimated_docs}")
                except Exception as e:
                    print(f"   {namespace}: Could not parse vector count ({type(info).__name__})")
            
            print(f"\n📄 Estimated Total Documents: ~{total_docs}")
        else:
            # Estimate from total vectors
            total_vectors = storage_info.get('total_vectors', 0)
            estimated_docs = max(1, total_vectors // 10) if total_vectors > 0 else 0
            print(f"\n📄 Estimated Total Documents: ~{estimated_docs}")
            print("   (Based on average 10 chunks per document)")
        
        # Check if we can get more detailed information
        try:
            print("\n🔍 Checking service health...")
            health_info = await pinecone_service.health_check()
            if health_info.get('status') == 'healthy':
                print("✅ Pinecone service is healthy")
                storage_stats = health_info.get('storage_stats', {})
                if storage_stats and not storage_stats.get('error'):
                    print(f"   Embedding Model: {health_info.get('embedding_model', 'Unknown')}")
                    print(f"   Dimensions: {health_info.get('embedding_dimensions', 'Unknown')}")
            else:
                print(f"⚠️  Service health issue: {health_info.get('error', 'Unknown')}")
        except Exception as e:
            print(f"   Note: Could not get health info: {e}")
        
        print("\n✅ Pinecone check completed successfully!")
        
    except Exception as e:
        print(f"❌ Error checking Pinecone documents: {e}")
        logger.error(f"Error in Pinecone check: {e}")

if __name__ == "__main__":
    asyncio.run(check_pinecone_documents())
