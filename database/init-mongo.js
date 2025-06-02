// MongoDB initialization script for Legal AI project
// This script runs when the MongoDB container starts for the first time

// Switch to the legal_ai database
db = db.getSiblingDB("legal_ai");

// Create the documents collection with validation schema
db.createCollection("documents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id", "filename", "upload_date"],
      properties: {
        id: {
          bsonType: "string",
          description: "must be a string and is required",
        },
        filename: {
          bsonType: "string",
          description: "must be a string and is required",
        },
        upload_date: {
          bsonType: "string",
          description: "must be a string and is required",
        },
        extracted_text: {
          bsonType: "string",
          description: "must be a string if provided",
        },
        sections: {
          bsonType: "array",
          description: "must be an array if provided",
          items: {
            bsonType: "object",
            required: ["heading", "text"],
            properties: {
              heading: {
                bsonType: "string",
                description: "must be a string and is required",
              },
              text: {
                bsonType: "string",
                description: "must be a string and is required",
              },
              summary: {
                bsonType: "string",
                description: "must be a string if provided",
              },
            },
          },
        },
        ai_summary: {
          bsonType: "string",
          description: "must be a string if provided",
        },
        processing_status: {
          bsonType: "string",
          enum: ["processing", "completed", "failed"],
          description: "must be one of the enum values if provided",
        },
      },
    },
  },
});

// Create indexes for better performance
db.documents.createIndex({ id: 1 }, { unique: true });
db.documents.createIndex({ upload_date: -1 });
db.documents.createIndex({ filename: 1 });
db.documents.createIndex({ processing_status: 1 });

// Create a user for the application (optional, for production environments)
// Uncomment the following lines if you want to create a dedicated user
/*
db.createUser({
    user: "legal_ai_user",
    pwd: "legal_ai_password",
    roles: [
        {
            role: "readWrite",
            db: "legal_ai"
        }
    ]
});
*/

print("MongoDB initialization completed successfully");
print("Database: legal_ai");
print("Collection: documents");
print("Indexes created: id (unique), upload_date, filename, processing_status");
