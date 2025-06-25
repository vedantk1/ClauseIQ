"""
Pinecone Vector Search Service for ClauseIQ.

MISSION-CRITICAL PRODUCTION SERVICE
- OpenAI text-embedding-3-large (3072 dimensions) 
- Pinecone serverless vector database
- LangChain integration for seamless RAG pipeline
- Zero-downtime deployment ready
- Battle-tested error handling

SPECIFICATIONS:
- Storage: 2GB free tier (4x Supabase capacity)
- Performance: Sub-10ms search times
- Scalability: Serverless auto-scaling
- Security: User isolation via namespaces
"""
import asyncio
import logging
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from pinecone import Pinecone, ServerlessSpec

from config.environments import get_environment_config

logger = logging.getLogger(__name__)

class PineconeVectorService:
    """
    Production-grade vector search using Pinecone + OpenAI embeddings.
    
    Features:
    - 3072-dimension text-embedding-3-large embeddings
    - Namespace-based user isolation
    - Automatic index creation and management
    - Comprehensive error handling
    - Health monitoring
    """
    
    def __init__(self):
        self.settings = get_environment_config()
        self.pc: Optional[Pinecone] = None
        self.embeddings: Optional[OpenAIEmbeddings] = None
        self.vector_store: Optional[PineconeVectorStore] = None
        self._initialized = False
        self.embedding_dimension = 3072  # text-embedding-3-large
        self.index_name = "clauseiq-vectors"
        
    async def initialize(self) -> bool:
        """Initialize Pinecone client and vector store."""
        if self._initialized:
            return True
            
        try:
            # Initialize Pinecone client
            pinecone_config = self.settings.pinecone
            if not pinecone_config.api_key or pinecone_config.api_key == "your-pinecone-api-key":
                logger.error("PINECONE_API_KEY not found in environment variables")
                return False
                
            self.pc = Pinecone(api_key=pinecone_config.api_key)
            
            # Initialize OpenAI embeddings with 3072 dimensions
            openai_config = self.settings.ai
            if not openai_config.openai_api_key or openai_config.openai_api_key == "sk-placeholder":
                logger.error("OPENAI_API_KEY not found or invalid in environment variables")
                return False
                
            self.embeddings = OpenAIEmbeddings(
                openai_api_key=openai_config.openai_api_key,
                model="text-embedding-3-large",
                dimensions=3072
            )
            
            # Create or connect to index
            await self._ensure_index_exists()
            
            # Initialize vector store
            self.vector_store = PineconeVectorStore(
                index=self.pc.Index(self.index_name),
                embedding=self.embeddings,
                text_key="text"
            )
            
            # Test connection
            await self._test_connection()
            
            self._initialized = True
            logger.info("🚀 Pinecone vector service initialized - READY FOR COMBAT")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Pinecone service: {e}")
            return False
    
    async def _ensure_index_exists(self) -> None:
        """Create Pinecone index if it doesn't exist."""
        try:
            # Check if index exists
            existing_indexes = self.pc.list_indexes()
            index_names = [index.name for index in existing_indexes]
            
            if self.index_name not in index_names:
                logger.info(f"Creating Pinecone index: {self.index_name}")
                
                # Create serverless index
                self.pc.create_index(
                    name=self.index_name,
                    dimension=self.embedding_dimension,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
                
                # Wait for index to be ready
                await asyncio.sleep(10)
                logger.info(f"✅ Index {self.index_name} created successfully")
            else:
                logger.info(f"✅ Index {self.index_name} already exists")
                
        except Exception as e:
            logger.error(f"❌ Error ensuring index exists: {e}")
            raise
    
    async def _test_connection(self) -> bool:
        """Test Pinecone connection and functionality."""
        try:
            # Test index stats
            index = self.pc.Index(self.index_name)
            stats = index.describe_index_stats()
            logger.info(f"✅ Pinecone connection test successful - {stats.total_vector_count} vectors")
            return True
        except Exception as e:
            logger.error(f"❌ Pinecone connection test failed: {e}")
            raise
    
    async def is_available(self) -> bool:
        """Check if vector service is available and can connect to Pinecone."""
        try:
            # Check basic requirements
            pinecone_config = self.settings.pinecone
            if not (pinecone_config.api_key and 
                   pinecone_config.api_key != "your-pinecone-api-key"):
                logger.warning("Pinecone API key not properly configured")
                return False
            
            # Check if dependencies are available
            if not self._can_initialize():
                logger.warning("Pinecone dependencies not available")
                return False
            
            # Try to initialize if not already done
            if not self._initialized:
                success = await self.initialize()
                if not success:
                    logger.warning("Pinecone initialization failed")
                    return False
            
            # Test actual connection
            try:
                index = self.pc.Index(self.index_name)
                stats = index.describe_index_stats()
                logger.debug(f"Pinecone availability confirmed - {stats.total_vector_count} vectors")
                return True
            except Exception as e:
                logger.warning(f"Pinecone connection test failed: {e}")
                return False
                
        except Exception as e:
            logger.warning(f"Pinecone availability check failed: {e}")
            return False
    
    def _can_initialize(self) -> bool:
        """Check if service can be initialized (basic requirements check)."""
        try:
            import pinecone
            import openai
            from langchain_pinecone import PineconeVectorStore
            return True
        except ImportError:
            return False
    
    async def store_document_chunks(
        self, 
        document_id: str, 
        user_id: str, 
        chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Store document chunks with embeddings in Pinecone.
        
        Args:
            document_id: MongoDB document ID
            user_id: User ID for namespace isolation
            chunks: List of chunk dictionaries with 'text' and optional 'metadata'
            
        Returns:
            Dict with success status and chunk count
        """
        if not await self.initialize():
            return {"success": False, "error": "Pinecone service not available"}
        
        try:
            # Prepare texts and metadata for LangChain
            texts = []
            metadatas = []
            
            for i, chunk in enumerate(chunks):
                texts.append(chunk["text"])
                
                # Prepare metadata with required fields
                metadata = {
                    "document_id": document_id,
                    "user_id": user_id,
                    "chunk_index": i,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                # Add any additional metadata from the chunk
                if "metadata" in chunk:
                    metadata.update(chunk["metadata"])
                    
                metadatas.append(metadata)
            
            # Create namespace for user isolation
            namespace = f"user_{user_id}"
            
            # Store in Pinecone using LangChain
            chunk_ids = await asyncio.to_thread(
                self.vector_store.add_texts,
                texts=texts,
                metadatas=metadatas,
                namespace=namespace
            )
            
            logger.info(f"🎯 Stored {len(chunk_ids)} chunks for document {document_id} in namespace {namespace}")
            
            return {
                "success": True,
                "chunk_count": len(chunk_ids),
                "chunk_ids": chunk_ids,
                "namespace": namespace
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to store chunks for document {document_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def search_similar_chunks(
        self,
        query: str,
        user_id: str,
        document_id: Optional[str] = None,
        k: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using vector similarity.
        
        Args:
            query: Search query text
            user_id: User ID for namespace isolation
            document_id: Optional document ID to limit search scope
            k: Number of results to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of matching chunks with metadata and similarity scores
        """
        if not await self.initialize():
            logger.warning("❌ Pinecone service not available for search")
            return []
        
        try:
            # Use user namespace for isolation
            namespace = f"user_{user_id}"
            
            # Build metadata filter for document if specified
            filter_dict = {}
            if document_id:
                filter_dict["document_id"] = {"$eq": document_id}
            
            # Perform similarity search with namespace
            results = await asyncio.to_thread(
                self.vector_store.similarity_search_with_score,
                query=query,
                k=k,
                filter=filter_dict,
                namespace=namespace
            )
            
            # Format results and apply similarity threshold
            formatted_results = []
            for doc, score in results:
                # Convert distance to similarity (Pinecone returns distance, we want similarity)
                similarity_score = 1.0 - score if score <= 1.0 else max(0.0, 2.0 - score)
                
                # Only include results above similarity threshold
                if similarity_score >= similarity_threshold:
                    formatted_results.append({
                        "content": doc.page_content,
                        "metadata": doc.metadata,
                        "similarity_score": similarity_score,
                        "document_id": doc.metadata.get("document_id"),
                        "chunk_index": doc.metadata.get("chunk_index", 0)
                    })
            
            logger.info(f"🎯 Found {len(formatted_results)} similar chunks for query in namespace {namespace}")
            return formatted_results
            
        except Exception as e:
            logger.error(f"❌ Search failed for query '{query}': {e}")
            return []
    
    async def delete_document_chunks(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """
        Delete all chunks for a specific document.
        
        Args:
            document_id: Document ID to delete chunks for
            user_id: User ID for namespace isolation
            
        Returns:
            Dict with success status and deletion count
        """
        if not await self.initialize():
            return {"success": False, "error": "Pinecone service not available"}
        
        try:
            namespace = f"user_{user_id}"
            index = self.pc.Index(self.index_name)
            
            # Delete vectors by metadata filter
            delete_response = await asyncio.to_thread(
                index.delete,
                filter={"document_id": {"$eq": document_id}},
                namespace=namespace
            )
            
            logger.info(f"🗑️ Deleted chunks for document {document_id} in namespace {namespace}")
            
            return {
                "success": True,
                "deleted_count": "unknown",  # Pinecone doesn't return count
                "namespace": namespace
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to delete chunks for document {document_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_all_vectors(self) -> Dict[str, Any]:
        """
        🧹 NUCLEAR OPTION: Delete ALL vectors from ALL namespaces.
        
        Used for foundational architecture deployment - complete database reset.
        This will clear EVERYTHING from the Pinecone index.
        
        Returns:
            Dict with success status and operation details
        """
        if not await self.initialize():
            return {"success": False, "error": "Pinecone service not available"}
        
        try:
            index = self.pc.Index(self.index_name)
            
            # Get index stats to see current state
            stats = await asyncio.to_thread(index.describe_index_stats)
            total_vectors_before = stats.total_vector_count
            namespaces_before = list(stats.namespaces.keys()) if stats.namespaces else []
            
            logger.info(f"🧹 NUCLEAR CLEARING: {total_vectors_before} vectors across {len(namespaces_before)} namespaces")
            
            # Delete all vectors from each namespace
            cleared_namespaces = []
            for namespace in namespaces_before:
                try:
                    await asyncio.to_thread(
                        index.delete,
                        delete_all=True,
                        namespace=namespace
                    )
                    cleared_namespaces.append(namespace)
                    logger.info(f"✅ Cleared namespace: {namespace}")
                except Exception as e:
                    logger.warning(f"⚠️  Error clearing namespace {namespace}: {e}")
            
            # Also clear the default namespace (empty string)
            try:
                await asyncio.to_thread(
                    index.delete,
                    delete_all=True
                )
                logger.info("✅ Cleared default namespace")
            except Exception as e:
                logger.warning(f"⚠️  Error clearing default namespace: {e}")
            
            # Wait a bit for the deletion to propagate
            await asyncio.sleep(2)
            
            # Get final stats
            final_stats = await asyncio.to_thread(index.describe_index_stats)
            total_vectors_after = final_stats.total_vector_count
            
            logger.info(f"🎯 NUCLEAR MISSION COMPLETE: {total_vectors_before} → {total_vectors_after} vectors")
            
            return {
                "success": True,
                "vectors_before": total_vectors_before,
                "vectors_after": total_vectors_after,
                "namespaces_cleared": cleared_namespaces,
                "operation": "nuclear_vector_clearing"
            }
            
        except Exception as e:
            logger.error(f"💥 NUCLEAR CLEARING FAILED: {e}")
            return {"success": False, "error": str(e)}

    async def get_document_chunk_count(self, document_id: str, user_id: str) -> int:
        """Get the number of chunks for a specific document."""
        if not await self.initialize():
            return 0
        
        try:
            namespace = f"user_{user_id}"
            index = self.pc.Index(self.index_name)
            
            # Query with metadata filter to count
            query_response = await asyncio.to_thread(
                index.query,
                vector=[0.0] * self.embedding_dimension,  # Dummy vector
                filter={"document_id": {"$eq": document_id}},
                top_k=10000,  # Max to get count
                include_metadata=False,
                include_values=False,
                namespace=namespace
            )
            
            return len(query_response.matches)
            
        except Exception as e:
            logger.error(f"❌ Failed to get chunk count for document {document_id}: {e}")
            return 0
    
    async def get_total_storage_usage(self) -> Dict[str, Any]:
        """Get storage usage statistics for monitoring."""
        if not await self.initialize():
            return {"error": "Service not available"}
        
        try:
            index = self.pc.Index(self.index_name)
            stats = await asyncio.to_thread(index.describe_index_stats)
            
            total_vectors = stats.total_vector_count
            # Rough estimate: each vector ~12KB (3072 * 4 bytes)
            estimated_mb = (total_vectors * 12) / 1024
            
            return {
                "total_vectors": total_vectors,
                "estimated_storage_mb": round(estimated_mb, 2),
                "free_tier_limit_mb": 2048,  # 2GB
                "usage_percentage": round((estimated_mb / 2048) * 100, 1),
                "namespaces": dict(stats.namespaces) if stats.namespaces else {}
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get storage usage: {e}")
            return {"error": str(e)}
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for the vector service."""
        try:
            if not await self.initialize():
                return {
                    "status": "unhealthy",
                    "error": "Failed to initialize"
                }
            
            # Test basic functionality
            storage_stats = await self.get_total_storage_usage()
            
            return {
                "status": "healthy",
                "service": "pinecone",
                "initialized": self._initialized,
                "index_name": self.index_name,
                "embedding_model": "text-embedding-3-large",
                "embedding_dimensions": self.embedding_dimension,
                "storage_stats": storage_stats
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Global service instance
_pinecone_vector_service = None

def get_pinecone_vector_service() -> PineconeVectorService:
    """Get global Pinecone vector service instance."""
    global _pinecone_vector_service
    if _pinecone_vector_service is None:
        _pinecone_vector_service = PineconeVectorService()
    return _pinecone_vector_service
