"""
RAG (Retrieval Augmented Generation) Service for ClauseIQ.

This service provides document chunking, embedding generation, vector storage,
and chat functionality using OpenAI's Vector Stores and embeddings API.

DESIGN PRINCIPLES:
- Zero disruption to existing functionality
- Additive enhancement to current document processing
- Safe fallbacks and error handling
- Cost-efficient with caching and batching

ARCHITECTURE:
- Document Chunking: Smart legal document segmentation
- Embeddings: OpenAI text-embedding-3-large for maximum accuracy
- Vector Storage: OpenAI Vector Stores (1GB free tier)
- RAG Pipeline: Retrieval + Generation with source attribution
"""
import asyncio
import hashlib
import json
import logging
import uuid
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

# Lazy imports for OpenAI
def _get_openai_client():
    """Lazy import OpenAI client."""
    try:
        # Use the correct relative import path from services directory
        from .ai.client_manager import get_openai_client
        return get_openai_client()
    except ImportError as e:
        logger.warning(f"Failed to import OpenAI client: {e}")
        return None

logger = logging.getLogger(__name__)

@dataclass
class DocumentChunk:
    """Represents a chunk of a legal document with metadata."""
    id: str
    text: str
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

@dataclass
class ChatMessage:
    """Represents a chat message with sources."""
    role: str  # 'user' or 'assistant'
    content: str
    sources: List[str] = None  # chunk IDs that contributed to this response
    timestamp: str = None
    
    def __post_init__(self):
        if self.sources is None:
            self.sources = []
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

@dataclass
class ChatSession:
    """Represents a chat session for a document."""
    session_id: str
    document_id: str
    user_id: str
    messages: List[ChatMessage]
    created_at: str
    updated_at: str

class RAGService:
    """Core RAG service for document chat functionality."""
    
    def __init__(self):
        # Get configuration
        from config.environments import get_environment_config
        self.config = get_environment_config()
        
        self.embedding_model = "text-embedding-3-large"  # Upgraded to 3072 dimensions
        self.chunk_size = 1000  # tokens
        self.chunk_overlap = 200  # tokens
        self.max_chunks_per_query = 5
        
        # Conversation context settings from config
        self.conversation_history_window = self.config.ai.conversation_history_window
        self.gate_model = self.config.ai.gate_model
        self.rewrite_model = self.config.ai.rewrite_model
        
        # Import Pinecone vector service lazily to avoid circular imports
        self._pinecone_service = None
        
    async def is_available(self) -> bool:
        """Check if RAG service is available."""
        try:
            # TACTICAL BYPASS: Use same OpenAI check as working AI services
            from config.environments import get_environment_config
            config = get_environment_config()
            
            # Check if OpenAI API key is configured
            if not config.ai.openai_api_key or config.ai.openai_api_key == "sk-placeholder":
                logger.warning("OpenAI API key not configured")
                return False
            
            # Check if Pinecone is configured
            if not config.pinecone.api_key or config.pinecone.api_key == "your-pinecone-api-key":
                logger.warning("Pinecone API key not configured")
                return False
                
            # If we get here, both services should be available
            logger.info("RAG service dependencies are configured - marking as available")
            return True
        except Exception as e:
            logger.warning(f"RAG service not available: {e}")
            return False
    
    def _get_pinecone_service(self):
        """Get Pinecone vector service instance."""
        if self._pinecone_service is None:
            from services.pinecone_vector_service import get_pinecone_vector_service
            self._pinecone_service = get_pinecone_vector_service()
        return self._pinecone_service
    
    def _generate_chunk_id(self, document_id: str, chunk_index: int) -> str:
        """Generate a unique ID for a document chunk."""
        return f"{document_id}_chunk_{chunk_index:04d}"
    
    def _smart_chunk_legal_document(self, text: str, document_id: str) -> List[DocumentChunk]:
        """
        Smart chunking for legal documents.
        Respects legal structure like sections, clauses, and articles.
        """
        chunks = []
        
        # Legal document section patterns
        section_patterns = [
            r'\n\s*(?:SECTION|Section)\s+\d+[.:]\s*',
            r'\n\s*(?:ARTICLE|Article)\s+\d+[.:]\s*',
            r'\n\s*(?:CLAUSE|Clause)\s+\d+[.:]\s*',
            r'\n\s*\d+\.\s+[A-Z][A-Za-z\s]+[.:]',
            r'\n\s*\([a-zA-Z0-9]+\)\s+',
            r'\n\s*WHEREAS\s*,?\s*',
            r'\n\s*NOW THEREFORE\s*,?\s*'
        ]
        
        # Find all potential split points
        split_points = [0]
        for pattern in section_patterns:
            import re
            for match in re.finditer(pattern, text):
                split_points.append(match.start())
        
        # Add end of document
        split_points.append(len(text))
        split_points = sorted(set(split_points))
        
        # Create chunks based on split points
        for i in range(len(split_points) - 1):
            start = split_points[i]
            end = split_points[i + 1]
            chunk_text = text[start:end].strip()
            
            if len(chunk_text) < 50:  # Skip very small chunks
                continue
                
            # If chunk is too large, split it further
            if len(chunk_text) > self.chunk_size * 4:  # Rough token estimate
                sub_chunks = self._split_large_chunk(chunk_text)
                for j, sub_chunk in enumerate(sub_chunks):
                    chunk_id = self._generate_chunk_id(document_id, len(chunks))
                    chunks.append(DocumentChunk(
                        id=chunk_id,
                        text=sub_chunk,
                        metadata={
                            "start_char": start + sum(len(sc) for sc in sub_chunks[:j]),
                            "end_char": start + sum(len(sc) for sc in sub_chunks[:j+1]),
                            "chunk_type": "sub_section",
                            "parent_section": i
                        }
                    ))
            else:
                chunk_id = self._generate_chunk_id(document_id, len(chunks))
                chunks.append(DocumentChunk(
                    id=chunk_id,
                    text=chunk_text,
                    metadata={
                        "start_char": start,
                        "end_char": end,
                        "chunk_type": "section",
                        "section_index": i
                    }
                ))
        
        logger.info(f"Created {len(chunks)} chunks for document {document_id}")
        return chunks
    
    def _split_large_chunk(self, text: str) -> List[str]:
        """Split a large chunk into smaller pieces while preserving sentence boundaries."""
        sentences = text.split('. ')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # Rough token estimate (1 token ≈ 4 characters)
            if len(current_chunk + sentence) > self.chunk_size * 4:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk += sentence + ". " if not sentence.endswith('.') else sentence + " "
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    async def generate_embeddings(self, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        """Generate embeddings for document chunks using OpenAI."""
        if not await self.is_available():
            logger.warning("OpenAI client not available, skipping embedding generation")
            return chunks
        
        try:
            client = _get_openai_client()
            
            # Batch embeddings for efficiency (max 2048 inputs per request)
            batch_size = 100  # Conservative batch size
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                texts = [chunk.text for chunk in batch]
                
                response = await client.embeddings.create(
                    model=self.embedding_model,
                    input=texts
                )
                
                # Assign embeddings to chunks
                for j, embedding_data in enumerate(response.data):
                    batch[j].embedding = embedding_data.embedding
                
                logger.info(f"Generated embeddings for batch {i//batch_size + 1}/{(len(chunks) + batch_size - 1)//batch_size}")
            
            logger.info(f"Successfully generated embeddings for {len(chunks)} chunks")
            return chunks
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            # Return chunks without embeddings - graceful degradation
            return chunks
    
    async def process_document_for_rag(self, document_id: str, text: str, filename: str, user_id: str) -> Dict[str, Any]:
        """
        Process a document for RAG by creating chunks and storing them in OpenAI Vector Store.
        Returns data to be stored in MongoDB alongside existing document data.
        """
        try:
            if not await self.is_available():
                logger.warning("RAG service not available for processing")
                return None
            
            # Step 1: Create chunks using legal document chunking
            chunks = self._smart_chunk_legal_document(text, document_id)
            logger.info(f"Created {len(chunks)} chunks for document {document_id}")
            
            # Step 2: Prepare chunks for Supabase storage
            chunk_data = []
            for i, chunk in enumerate(chunks):
                chunk_data.append({
                    "text": chunk.text,
                    "metadata": {
                        **chunk.metadata,
                        "chunk_id": chunk.id,
                        "filename": filename,
                        "processed_at": datetime.utcnow().isoformat()
                    }
                })
            
            # Step 3: Store chunks in Pinecone with embeddings
            pinecone_service = self._get_pinecone_service()
            storage_result = await pinecone_service.store_document_chunks(
                document_id=document_id,
                user_id=user_id,
                chunks=chunk_data
            )
            
            if not storage_result.get("success", False):
                logger.error(f"Failed to store chunks in Pinecone: {storage_result.get('error')}")
                # Don't raise exception - document can still exist without RAG
                return None
            
            # Step 4: Prepare RAG metadata for MongoDB
            rag_data = {
                "pinecone_stored": True,
                "chunk_count": storage_result.get("chunk_count", len(chunks)),
                "chunk_ids": storage_result.get("chunk_ids", []),
                "embedding_model": self.embedding_model,
                "processed_at": datetime.utcnow().isoformat(),
                "storage_service": "pinecone"
            }
            
            logger.info(f"Successfully processed document {document_id} for RAG with {len(chunks)} chunks in Pinecone")
            return rag_data
            
        except Exception as e:
            logger.error(f"Error processing document {document_id} for RAG: {e}")
            raise e
    
    def _calculate_similarity(self, query_embedding: List[float], chunk_embedding: List[float]) -> float:
        """Calculate cosine similarity between two embeddings."""
        try:
            import numpy as np
            
            # Convert to numpy arrays
            query_vec = np.array(query_embedding)
            chunk_vec = np.array(chunk_embedding)
            
            # Calculate cosine similarity
            dot_product = np.dot(query_vec, chunk_vec)
            norm_query = np.linalg.norm(query_vec)
            norm_chunk = np.linalg.norm(chunk_vec)
            
            if norm_query == 0 or norm_chunk == 0:
                return 0.0
            
            similarity = dot_product / (norm_query * norm_chunk)
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
    
    async def _needs_conversation_context(self, query: str) -> bool:
        """Gate: Determine if query needs conversation context using gpt-4o-mini."""
        try:
            client = _get_openai_client()
            if not client:
                return False
            
            gate_prompt = """Analyze if this user question requires previous conversation context to be understood correctly.

Return only "YES" if the question contains:
- Pronouns referring to previous topics ("that", "it", "those", "this")
- References to earlier discussion ("as we discussed", "you mentioned", "from before")
- Comparative language needing context ("compare that to", "how does this differ")
- Follow-up requests ("tell me more", "explain further", "give details")

Return only "NO" if the question is standalone and can be answered independently.

Question: "{query}"

Response (YES or NO only):"""

            response = await client.chat.completions.create(
                model=self.gate_model,
                messages=[{"role": "user", "content": gate_prompt.format(query=query)}],
                max_tokens=10,
                temperature=0.0
            )
            
            result = response.choices[0].message.content.strip().upper()
            needs_context = result == "YES"
            
            logger.info(f"🚪 Gate decision for '{query}': {needs_context} (raw: '{result}')")
            return needs_context
            
        except Exception as e:
            logger.error(f"Error in conversation context gate: {e}")
            # Default to False on error to avoid breaking the flow
            return False
    
    async def _rewrite_query_with_context(self, query: str, conversation_history: List[Dict[str, Any]]) -> str:
        """Rewrite query using conversation context to resolve references."""
        try:
            client = _get_openai_client()
            if not client:
                return query
            
            # Use last N messages max to avoid token limits (from config)
            recent_history = conversation_history[-self.conversation_history_window:] if len(conversation_history) > self.conversation_history_window else conversation_history
            
            # Format conversation context
            context_parts = []
            for msg in recent_history:
                role = msg.get('role', 'unknown')
                content = msg.get('content', '')
                if content:
                    context_parts.append(f"{role.title()}: {content}")
            
            context_text = "\n".join(context_parts)
            
            rewrite_prompt = f"""Based on the conversation history, rewrite the follow-up question to be self-contained and clear.

CONVERSATION HISTORY:
{context_text}

FOLLOW-UP QUESTION: {query}

Rewrite the follow-up question so it can be understood without the conversation history. Replace pronouns and references with specific terms from the context.

Examples:
- "Tell me about that in detail" → "Tell me about the payment terms in detail"
- "Is that enforceable?" → "Are the termination clauses enforceable?"
- "What does it mean?" → "What does the non-compete agreement mean?"

REWRITTEN QUESTION:"""

            response = await client.chat.completions.create(
                model=self.rewrite_model,
                messages=[{"role": "user", "content": rewrite_prompt}],
                max_tokens=100,
                temperature=0.1
            )
            
            rewritten_query = response.choices[0].message.content.strip()
            
            logger.info(f"✏️  Query rewritten: '{query}' → '{rewritten_query}'")
            return rewritten_query
            
        except Exception as e:
            logger.error(f"Error rewriting query: {e}")
            # Return original query on error
            return query

    async def retrieve_relevant_chunks(
        self, 
        query: str, 
        document_id: str,
        user_id: str,
        conversation_history: List[Dict[str, Any]] = None,
        max_chunks: int = None
    ) -> Dict[str, Any]:
        """Retrieve the most relevant chunks for a query with enhanced conversation context."""
        if not await self.is_available():
            logger.warning("RAG service not available for query processing")
            return {"chunks": [], "enhanced_query": query}
        
        if max_chunks is None:
            max_chunks = self.max_chunks_per_query
        
        # Enhanced query processing with conversation context
        enhanced_query = query
        
        if conversation_history and len(conversation_history) > 0:
            # Gate: Check if query needs conversation context
            needs_context = await self._needs_conversation_context(query)
            
            if needs_context:
                # Rewrite query with conversation context
                enhanced_query = await self._rewrite_query_with_context(query, conversation_history)
        
        try:
            # Use Pinecone vector search with enhanced query
            pinecone_service = self._get_pinecone_service()
            search_results = await pinecone_service.search_similar_chunks(
                query=enhanced_query,
                user_id=user_id,
                document_id=document_id,
                k=max_chunks,
                similarity_threshold=0.3
            )
            
            # FALLBACK: If enhanced query finds no results, try original query
            if not search_results and enhanced_query != query:
                logger.info(f"🔄 Enhanced query found no results, trying original query: '{query}'")
                search_results = await pinecone_service.search_similar_chunks(
                    query=query,
                    user_id=user_id,
                    document_id=document_id,
                    k=max_chunks,
                    similarity_threshold=0.2  # Lower threshold for fallback
                )
            
            # Format results for compatibility with existing code
            formatted_results = []
            for result in search_results:
                formatted_results.append({
                    "content": result["content"],
                    "metadata": result["metadata"], 
                    "similarity_score": result["similarity_score"],
                    "source": "pinecone_vector",
                    "chunk_id": result["metadata"].get("chunk_id"),
                    "document_id": result["document_id"]
                })
            
            logger.info(f"🔍 Retrieved {len(formatted_results)} relevant chunks for query '{enhanced_query}' in document {document_id}")
            
            return {
                "chunks": formatted_results,
                "enhanced_query": enhanced_query
            }
            
        except Exception as e:
            logger.error(f"Error retrieving chunks from Pinecone: {e}")
            # Return empty list if search fails - better than crashing
            return {"chunks": [], "enhanced_query": query}
    
    async def generate_rag_response(
        self, 
        query: str, 
        relevant_chunks: List[Dict[str, Any]], 
        enhanced_query: str = None,
        model: str = None
    ) -> Dict[str, Any]:
        """Generate a response using RAG with retrieved chunks."""
        if not await self.is_available():
            return {
                "response": "I'm sorry, but the AI service is currently unavailable. Please try again later.",
                "sources": [],
                "error": "AI service unavailable"
            }
        
        try:
            # Get model from settings if not provided
            if model is None:
                from config.environments import get_environment_config
                config = get_environment_config()
                model = config.ai.default_model
            
            client = _get_openai_client()
            if not client:
                return {
                    "response": "I'm sorry, but the AI service is currently unavailable. Please try again later.",
                    "sources": [],
                    "error": "OpenAI client not available"
                }
            
            # Prepare context from relevant chunks
            context_parts = []
            source_chunks = []
            
            for i, chunk in enumerate(relevant_chunks):
                context_parts.append(f"[Source {i+1}] {chunk['content']}")
                source_chunks.append(chunk['chunk_id'])
            
            context = "\n\n".join(context_parts)
            
            # Use enhanced query if provided, otherwise use original query
            final_query = enhanced_query if enhanced_query else query
            
            # Create prompt for RAG
            prompt = f"""You are a legal document assistant. Answer the user's question based ONLY on the provided context from their legal document. 

IMPORTANT GUIDELINES:
- Only use information that appears in the provided context
- If the answer isn't in the context, say "I cannot find that information in your document"
- Always cite your sources by referencing [Source X] numbers
- Provide accurate, helpful legal information while noting this is not legal advice
- Be specific and quote relevant text when appropriate

CONTEXT FROM DOCUMENT:
{context}

USER QUESTION: {final_query}

RESPONSE:"""
            
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful legal document assistant that answers questions based solely on provided document context."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.1  # Low temperature for consistent, factual responses
            )
            
            return {
                "response": response.choices[0].message.content,
                "sources": source_chunks,
                "model": model,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating RAG response: {e}")
            return {
                "response": f"I'm sorry, but I encountered an error while processing your question: {str(e)}",
                "sources": [],
                "error": str(e)
            }
    
    async def _get_or_create_vector_store(self, user_id: str) -> str:
        """Get or create a vector store for the user."""
        try:
            client = _get_openai_client()
            
            # For now, create one vector store per user
            # In production, you might want to optimize this
            vector_store_name = f"clauseiq-user-{user_id}"
            
            # Try to find existing vector store
            vector_stores = await client.vector_stores.list()
            async for vs in vector_stores:
                if vs.name == vector_store_name:
                    logger.info(f"Using existing vector store {vs.id} for user {user_id}")
                    return vs.id
            
            # Create new vector store
            vector_store = await client.vector_stores.create(
                name=vector_store_name,
                expires_after={
                    "anchor": "last_active_at",
                    "days": 90  # Auto-cleanup after 90 days of inactivity
                }
            )
            
            logger.info(f"Created new vector store {vector_store.id} for user {user_id}")
            return vector_store.id
            
        except Exception as e:
            logger.error(f"Error creating vector store for user {user_id}: {e}")
            raise e
    
    async def _upload_to_vector_store(self, vector_store_id: str, text: str, filename: str) -> str:
        """Upload document text to vector store."""
        try:
            import tempfile
            import os
            
            client = _get_openai_client()
            
            # Create a temporary file with the document text
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
                temp_file.write(text)
                temp_file_path = temp_file.name
            
            try:
                # Upload file to OpenAI
                with open(temp_file_path, 'rb') as file_obj:
                    file_response = await client.files.create(
                        file=file_obj,
                        purpose="assistants"
                    )
                
                # Add file to vector store
                await client.vector_stores.files.create(
                    vector_store_id=vector_store_id,
                    file_id=file_response.id
                )
                
                logger.info(f"Uploaded file {filename} to vector store {vector_store_id}")
                return file_response.id
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    logger.warning(f"Could not delete temp file {temp_file_path}: {e}")
                    
        except Exception as e:
            logger.error(f"Error uploading file to vector store: {e}")
            raise e
    
    async def _retrieve_from_local_chunks(self, query: str, chunks: List[Dict[str, Any]], max_chunks: int) -> List[Dict[str, Any]]:
        """Fallback method to retrieve chunks using local embeddings."""
        if not chunks:
            return []
        
        try:
            client = _get_openai_client()
            
            # Generate embedding for the query
            response = await client.embeddings.create(
                model=self.embedding_model,
                input=[query]
            )
            query_embedding = response.data[0].embedding
            
            # Calculate similarities with stored chunks
            chunk_similarities = []
            for chunk in chunks:
                # For local chunks, we don't store embeddings yet (would be expensive)
                # Instead, do simple text matching as fallback
                text_lower = chunk.get("text", "").lower()
                query_lower = query.lower()
                
                # Simple keyword matching score
                query_words = query_lower.split()
                text_words = text_lower.split()
                
                matches = sum(1 for word in query_words if word in text_words)
                score = matches / len(query_words) if query_words else 0
                
                if score > 0.1:  # Minimum relevance threshold
                    chunk_similarities.append((chunk, score))
            
            # Sort by similarity and return top chunks
            chunk_similarities.sort(key=lambda x: x[1], reverse=True)
            relevant_chunks = [chunk for chunk, score in chunk_similarities[:max_chunks]]
            
            logger.info(f"Retrieved {len(relevant_chunks)} chunks using fallback method")
            return relevant_chunks
            
        except Exception as e:
            logger.error(f"Error in fallback chunk retrieval: {e}")
            # Last resort: return first few chunks
            return chunks[:max_chunks] if chunks else []
    
    async def delete_document_from_rag(self, document_id: str, user_id: str) -> bool:
        """
        Delete all RAG data for a document when it's deleted from MongoDB.
        This ensures consistency between MongoDB and Supabase.
        """
        try:
            pinecone_service = self._get_pinecone_service()
            deletion_result = await pinecone_service.delete_document_chunks(
                document_id=document_id,
                user_id=user_id
            )
            
            if deletion_result.get("success", False):
                deleted_count = deletion_result.get("deleted_count", 0)
                logger.info(f"Deleted {deleted_count} chunks from Pinecone for document {document_id}")
                return True
            else:
                logger.warning(f"Failed to delete chunks from Pinecone: {deletion_result.get('error')}")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting document {document_id} from RAG: {e}")
            return False

    async def get_document_rag_status(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """Get RAG processing status for a document."""
        try:
            # Get document from MongoDB
            from database.service import get_document_service
            doc_service = get_document_service()
            document = await doc_service.get_document_for_user(document_id, user_id)
            
            if not document:
                return {"available": False, "error": "Document not found"}
            
            # Check if document has RAG data
            rag_processed = document.get("rag_processed", False)
            if not rag_processed:
                return {"available": False, "reason": "Document not processed for RAG"}
            
            # Get chunk count from Pinecone
            pinecone_service = self._get_pinecone_service()
            chunk_count = await pinecone_service.get_document_chunk_count(document_id, user_id)
            
            return {
                "available": True,
                "rag_processed": True,
                "chunk_count": chunk_count,
                "embedding_model": document.get("rag_embedding_model", self.embedding_model),
                "processed_at": document.get("rag_processed_at"),
                "storage_service": "pinecone"
            }
            
        except Exception as e:
            logger.error(f"Error getting RAG status for document {document_id}: {e}")
            return {"available": False, "error": str(e)}


# Global RAG service instance
_rag_service = None

def get_rag_service() -> RAGService:
    """Get the global RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
