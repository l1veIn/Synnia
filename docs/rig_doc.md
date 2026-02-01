### Full Example Workflow for Rig-Qdrant Integration in Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/qdrant

A complete example demonstrating the setup, connection, collection creation, vector store initialization, and top-N search using the rig-qdrant crate with OpenAI embeddings. Requires OPENAI_API_KEY environment variable.

```rust
const COLLECTION_NAME: &str = "MY_COLLECTION";
const COLLECTION_SIZE: usize = 1536; // vector embedding size for the collection goes here

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let openai_api_key = env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY not set");
    let openai_client = Client::new(&openai_api_key);
    let model = openai_client.embedding_model(TEXT_EMBEDDING_ADA_002);
 
    let qdrant_client = Qdrant::connect("http://localhost:6334").await?;
 
    // Create a collection with 1536 dimensions if it doesn't exist
    // Note: Make sure the dimensions match the size of the embeddings returned by the
    // model you are using
    if !qdrant_client.collection_exists(COLLECTION_NAME).await? {
        qdrant_client.create_collection(
            CreateCollectionBuilder::new(COLLECTION_NAME)
                .vectors_config(VectorParamsBuilder::new(
                    COLLECTION_SIZE as u64,
                    qdrant_client::qdrant::Distance::Cosine)
                ),
            ).await?;
    }
 
    let query_params = QueryPointsBuilder::new(COLLECTION_NAME).with_payload(true);
    let vector_store = QdrantVectorStore::new(qdrant_inner, model.clone(), query_params.build());
 
 
    let results = vector_store.top_n::<Utterance>(query, 1).await?;
    println!("{:#?}", results);
 
    Ok(())
}

```

--------------------------------

### OpenAI Client Initialization Example (Rust)

Source: https://docs.rig.rs/docs/integrations/model_providers/openai

A minimal example showing the creation of an OpenAI client and a GPT-4o completion model. This snippet is useful for quick integration tests.

```rust
use rig::providers::openai;

let client = openai::Client::new("YOUR_API_KEY");

let gpt4o = client.completion_model(openai::GPT_4O);
```

--------------------------------

### Full Example Workflow: Rig-SurrealDB Integration

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

A complete Rust example demonstrating the setup and usage of the `rig-surrealdb` crate. It connects to SurrealDB, initializes an OpenAI embedding model, creates a vector store, inserts documents, and performs a similarity search.

```rust
use rig::{embeddings::EmbeddingsBuilder, vector_store::VectorStoreIndex, Embed};
use rig_surrealdb::{Mem, SurrealVectorStore};
use serde::{Deserialize, Serialize};
use surrealdb::Surreal;

#[derive(Embed, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Default)]
struct WordDefinition {
    word: String,
    #[serde(skip)]
    #[embed]
    definition: String,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let openai_client = rig::providers::openai::Client::from_env();
    let model = openai_client.embedding_model(rig::providers::openai::TEXT_EMBEDDING_3_SMALL);

    let surreal = Surreal::new::<Mem>(()).await?;
    surreal.use_ns("example").use_db("example").await?;

    let words = vec![
        WordDefinition {
            word: "flurbo".to_string(),
            definition: "A fictional currency from Rick and Morty.".to_string()
        },
        WordDefinition {
            word: "glarb-glarb".to_string(),
            definition: "A creature from the marshlands of Glibbo.".to_string()
        },
    ];

    let documents = EmbeddingsBuilder::new(model.clone())
        .documents(words)
        .unwrap()
        .build()
        .await?;

    let vector_store = SurrealVectorStore::with_defaults(model, surreal);
    vector_store.insert_documents(documents).await?;

    let query = "weird alien creature";
    let results = vector_store.top_n::<WordDefinition>(query, 2).await?;

    for (distance, _id, doc) in results {
        println!("Distance: {:.3}, Word: {}", distance, doc.word);
    }

    Ok(())
}

```

--------------------------------

### RAG System Setup with OpenAI and In-Memory Vector Store in Rust

Source: https://docs.rig.rs/docs/why_rig

Illustrates setting up a Retrieval-Augmented Generation (RAG) system using Rig.rs. This example involves initializing an OpenAI client, creating an embedding model, populating an in-memory vector store, and performing a vector search to retrieve relevant information for a query. It highlights Rig's abstractions for simplifying RAG system development.

```rust
use rig::{
    client::EmbeddingsClient,
    embeddings::EmbeddingsBuilder,
    providers::openai,
    vector_store::{VectorSearchRequest, VectorStoreIndex, in_memory_store::InMemoryVectorStore},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize OpenAI client and create an embedding model
    let openai_client = openai::Client::from_env();
    let embedding_model = openai_client.embedding_model("text-embedding-ada-002");

    // Create an in-memory vector store
    let mut vector_store = InMemoryVectorStore::default();

    // Generate embeddings for two documents
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .documents(vec![
            "1. Rust is a systems programming language.",
            "2. Python is known for its simplicity.",
        ])? 
        .build()
        .await?;

    // Add the embeddings to the vector store
    vector_store.add_documents(embeddings);

    // Create an index from the vector store
    let index = vector_store.index(embedding_model);
    let req = VectorSearchRequest::builder()
        .samples(1)
        .query("What is Rust?")
        .build()?;
    let results = VectorStoreIndex::top_n::<String>(&index, req).await?;

    // Print the most relevant document
    println!("RAG Agent Response: {}", results[0]);

    Ok(())
}
```

--------------------------------

### Full Example: Neo4j Vector Store Workflow

Source: https://docs.rig.rs/docs/integrations/vector_stores/neo4j

A complete example demonstrating the workflow of connecting to Neo4j, creating a vector index, retrieving the index, and performing a top-N vector search. This showcases the core functionality of the rig-neo4j crate.

```rust
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let neo4j_client = Neo4jClient::connect("neo4j://localhost:7687", "username", "password").await?;
    let model = openai_client.embedding_model(TEXT_EMBEDDING_ADA_002);
 
    neo4j_client.create_vector_index(
        IndexConfig::new("moviePlots"),
        "Movie",
        &model
    ).await?;
 
    let index = neo4j_client.get_index(model, "moviePlots", SearchParams::default()).await?;
    let results = index.top_n::<Movie>("a historical movie on quebec", 5).await?;
    println!("{:#?}", results);
 
    Ok(())
}

```

--------------------------------

### Gemini Agent Example using Rust

Source: https://docs.rig.rs/examples/model_providers/gemini

Demonstrates how to create and interact with a Gemini agent for conversational AI. It initializes the Gemini client, configures agent parameters like temperature and generation settings, and prompts the agent with a question. Requires the 'rig' crate and Gemini API credentials.

```rust
use rig::completion::Prompt;
use rig::providers::gemini::{self, completion::gemini_api_types::GenerationConfig};

#[tracing::instrument(ret)]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .with_target(false)
        .init();

    // Initialize the Google Gemini client
    let client = gemini::Client::from_env();

    // Create agent with a single context prompt
    let agent = client
        .agent(gemini::completion::GEMINI_1_5_PRO)
        .preamble("Be creative and concise. Answer directly and clearly.")
        .temperature(0.5)
        // The `GenerationConfig` utility struct helps construct a typesafe `additional_params`
        .additional_params(serde_json::to_value(GenerationConfig {
            top_k: Some(1),
            top_p: Some(0.95),
            candidate_count: Some(1),
            ..Default::default()
        })?) // Unwrap the Result to get the Value
        .build();

    tracing::info!("Prompting the agent...");

    // Prompt the agent and print the response
    let response = agent
        .prompt("How much wood would a woodchuck chuck if a woodchuck could chuck wood? Infer an answer.")
        .await;

    tracing::info!("Response: {:?}", response);

    match response {
        Ok(response) => println!("{}", response),
        Err(e) => {
            tracing::error!("Error: {:?}", e);
            return Err(e.into());
        }
    }

    Ok(())
}

```

--------------------------------

### Rust: OpenAI LLM Completion Example

Source: https://docs.rig.rs/index

Demonstrates how to use the Rig library to interact with OpenAI's GPT-4 model for text completion. This example requires the `OPENAI_API_KEY` environment variable to be set and utilizes `tokio` for asynchronous operations.

```rust
use rig::{completion::Prompt, providers::openai};

#[tokio::main]
async fn main() {
    // Create OpenAI client and agent.
    // This requires the `OPENAI_API_KEY` environment variable to be set.
    let openai_client = openai::Client::from_env();

    let gpt4 = openai_client.agent("gpt-4").build();

    // Prompt the model and print its response
    let response = gpt4
        .prompt("Who are you?")
        .await
        .expect("Failed to prompt GPT-4");

    println!("GPT-4: {response}");
}
```

--------------------------------

### Document Embedding and Search Integration Example in Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Demonstrates a complete example of document embedding and search using LanceDB and OpenAI. This example initializes an OpenAI client, selects an embedding model, connects to a local LanceDB instance, and generates embeddings for test data. It highlights the requirement of at least 256 rows for index creation, showing how to duplicate data for testing purposes.

```rust
#[path = "./fixtures/lib.rs"]
mod fixture;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    // Initialize OpenAI client. Use this to generate embeddings (and generate test data for RAG demo).
    let openai_client = Client::from_env();

    // Select an embedding model.
    let model = openai_client.embedding_model(TEXT_EMBEDDING_ADA_002);

    // Initialize LanceDB locally.
    let db = lancedb::connect("data/lancedb-store").execute().await?;

    // Generate embeddings for the test data.
    let embeddings = EmbeddingsBuilder::new(model.clone())
        .documents(words())? 
        // Note: need at least 256 rows in order to create an index so copy the definition 256 times for testing purposes.
        .documents(
            (0..256)

```

--------------------------------

### Example: Using OpenAI Provider in Rig

Source: https://docs.rig.rs/docs/integrations

Demonstrates how to initialize and use the OpenAI client and models within the Rig framework. It shows creating a client with an API key, initializing a completion model, and setting up an agent with a preamble.

```rust
use rig::providers::openai;

// Initialize the client
let client = openai::Client::new("your-api-key");

// Create a model
let gpt4 = client.completion_model("gpt-4");

// Or create an agent directly
let agent = client.agent("gpt-4")
    .preamble("You are a helpful assistant")
    .build();
```

--------------------------------

### Set Up Environment Variables

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This section details how to set up environment variables for API keys using a .env file. It includes commands to create the file and examples of how to add the OpenAI and RapidAPI keys.

```bash
touch .env
```

```bash
OPENAI_API_KEY=your_openai_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here
```

--------------------------------

### Usage Example: In-Memory Vector Store (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

A complete example demonstrating the usage of the InMemoryVectorStore. It covers initializing the store, creating embeddings using EmbeddingsBuilder, adding documents, indexing, and performing similarity searches.

```rust
use rig::providers::openai;
use rig::embeddings::EmbeddingsBuilder;
use rig::vector_store::in_memory_store::InMemoryVectorStore;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    // Initialize store
    let mut store = InMemoryVectorStore::default();

    // Create embeddings
    let embeddings = EmbeddingsBuilder::new(model)
        .simple_document("doc1", "First document content")
        .simple_document("doc2", "Second document content")
        .build()
        .await?;

    // Add documents to store
    store.add_documents(embeddings);

    // Create vector store index
    let index = store.index(model);

    // Search similar documents
    let results = store
        .top_n::<Document>("search query", 5)
        .await?;

    Ok(())
}
```

--------------------------------

### Rust Project Setup with Cargo

Source: https://docs.rig.rs/guides/rag/rag_system

Initializes a new Rust project using Cargo and navigates into the project directory. This is the first step in setting up the environment for the RAG system.

```bash
cargo new rag_system
cd rag_system
```

--------------------------------

### Install MCP Client Dependencies (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Installs the `rmcp` crate with client, macros, and HTTP transport features, and enables the `rmcp` feature on the `rig-core` crate. This is the first step to setting up an MCP client.

```rust
cargo add rmcp -F client,macros,transport-streamable-http-client-reqwest,\\
    transport-streamable-http-server
cargo add rig-core -F rmcp
```

--------------------------------

### Build and Upload Lambda Binaries to S3 for EFS Setup (Shell)

Source: https://docs.rig.rs/guides/deploy/Blog_2_aws_lambda_lancedb

Compiles Rust Lambda functions for use with EFS, zips the binaries, and uploads them to an S3 bucket. This process prepares the deployment artifacts for Lambda functions that will access the EFS-mounted LanceDB store.

```bash
# Can also do this directly on the AWS console
aws s3api create-bucket --bucket <your_bucket_name>

cargo lambda build --release --bin loader
cargo lambda build --release --bin app

cd target/lambda/loader
zip -r bootstrap.zip bootstrap
# Can also do this directly on the AWS console
aws s3 cp bootstrap.zip s3://<your_bucket_name>/rig/loader/

cd ..
zip -r bootstrap.zip bootstrap
# Can also do this directly on the AWS console
aws s3 cp bootstrap.zip s3://<your_bucket_name>/rig/app/
```

--------------------------------

### Implement Main Function for Rig Bot (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

Sets up and starts the Discord bot. It initializes logging, retrieves the bot token, creates a RigAgent instance, defines gateway intents, and starts the Discord client with an event handler. Requires `tokio`, `dotenv`, `tracing`, `discord_client`, and `anyhow` crates.

```rust
#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
 
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();
 
    let token = env::var("DISCORD_TOKEN").expect("Expected DISCORD_TOKEN in environment");
 
    let rig_agent = Arc::new(RigAgent::new().await?);
 
    let intents = GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::DIRECT_MESSAGES
        | GatewayIntents::MESSAGE_CONTENT;
 
    let mut client = Client::builder(&token, intents)
        .event_handler(Handler {
            rig_agent: Arc::clone(&rig_agent),
        })
        .await
        .expect("Err creating client");
 
    if let Err(why) = client.start().await {
        error!("Client error: {:?}", why);
    }
 
    Ok(())
}
```

--------------------------------

### Install MCP Server Dependencies (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Installs the `rmcp` crate with server and macro features, along with the `tokio` runtime. This is required for creating and running an MCP server.

```rust
cargo add rmcp -F server,macros,transport-streamable-http-server
cargo add tokio -F full
```

--------------------------------

### Gemini Embeddings Example using Rust

Source: https://docs.rig.rs/examples/model_providers/gemini

Demonstrates how to generate embeddings for text data using the Gemini API. It initializes the Gemini client and uses the 'Embed' trait to create embeddings for structured data. Requires the 'rig' crate and Gemini API credentials.

```rust
use rig::providers::gemini;
use rig::Embed;

#[derive(Embed, Debug)]
struct Greetings {
    #[embed]
    message: String,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    // Initialize the Google Gemini client
    // Create OpenAI client
    let client = gemini::Client::from_env();

    let embeddings = client
        .embeddings(gemini::embedding::EMBEDDING_001)
        .document(Greetings {
            message: "Hello, world!".to_string(),
        })?
        .document(Greetings {
            message: "Goodbye, world!".to_string(),
        })?
        .build()
        .await
        .expect("Failed to embed documents");

    println!("{:?}", embeddings);

    Ok(())
}

```

--------------------------------

### Create New Rust Project with Cargo

Source: https://docs.rig.rs/guides/advanced/flight_assistant

Initializes a new Rust project using the Cargo build system and navigates into the project directory. This is the standard way to start a new Rust project.

```bash
cargo new flight_search_assistant
cd flight_search_assistant
```

--------------------------------

### Example Error Handling for Vector Store Operations in Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

Demonstrates how to handle various potential errors when interacting with a vector store, including JSON deserialization errors and general storage errors. This example uses a `match` statement to differentiate between successful retrieval, document not found, and different error types.

```rust
match store.get_document::<MyDoc>("doc1") {
    Ok(Some(doc)) => println!("Found document: {:?}", doc),
    Ok(None) => println!("Document not found"),
    Err(VectorStoreError::JsonError(e)) => println!("Failed to deserialize: {}", e),
    Err(e) => println!("Other error: {}", e),
}
```

--------------------------------

### Document Schema Example (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/mongodb

An example struct `Document` demonstrating the required schema for documents stored in MongoDB for vector search. It includes an `_id`, `content`, and an `embedding` vector.

```rust
#[derive(Embed, Clone, Deserialize, Debug)]
struct Document {
    #[serde(rename = "_id")]
    id: String,
    #[embed]
    content: String,
    embedding: Vec<f64>,
}
```

--------------------------------

### Initialize LanceDB on S3 and Prepare Embeddings

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Shows how to connect LanceDB to S3 storage and prepare embeddings for a large dataset. This example requires IAM permissions for S3 access and sufficient data rows to create an index.

```rust
    let model = openai_client.embedding_model(TEXT_EMBEDDING_ADA_002);

    // Initialize LanceDB on S3.
    // Note: see below docs for more options and IAM permission required to read/write to S3.
    // https://lancedb.github.io/lancedb/guides/storage/#aws-s3
    let db = lancedb::connect("s3://lancedb-test-829666124233")
        .execute()
        .await?;

    // Generate embeddings for the test data.
    let embeddings = EmbeddingsBuilder::new(model.clone())
        .documents(words())?
        // Note: need at least 256 rows in order to create an index so copy the definition 256 times for testing purposes.
        .documents(
            (0..256)
                .map(|i| Word {
                    id: format!("doc{{}}", i),
                    definition: "Definition of *flumbuzzle (noun)*: A sudden, inexplicable urge to rearrange or reorganize small objects, such as desk items or books, for no apparent reason.".to_string()
                })

```

--------------------------------

### Initialize OpenAI Client and Agent - Rust

Source: https://docs.rig.rs/docs/integrations/model_providers

This Rust code snippet demonstrates how to initialize a client for the OpenAI provider and subsequently create an agent. It shows two methods for agent initialization: one using AgentBuilder and another directly through the client. The example requires an OpenAI API key and specifies the model 'gpt-4o'.

```rust
use rig::{providers::openai, agent::AgentBuilder};

// Initialize the OpenAI client
let openai = openai::Client::new("your-openai-api-key");

// Create a model and initialize an agent
let gpt_4o = openai.completion_model("gpt-4o");

let agent = AgentBuilder::new(gpt_4o)
    .preamble("\
        You are Gandalf the white and you will be conversing with other \
        powerful beings to discuss the fate of Middle Earth.\
    ")
    .build();

// Alternatively, you can initialize an agent directly
let agent = openai.agent("gpt-4o")
    .preamble("\
        You are Gandalf the white and you will be conversing with other \
        powerful beings to discuss the fate of Middle Earth.\
    ")
    .build();
```

--------------------------------

### Sentiment Analysis with Prompt Engineering in Rust

Source: https://docs.rig.rs/guides/text_extraction_classification

This snippet demonstrates how to configure a sentiment classifier using the Rig RS library. It utilizes an OpenAI client and defines a preamble with examples to guide the sentiment analysis model. The output is a SentimentClassification object.

```rust
let sentiment_classifier = openai_client
    .extractor::<SentimentClassification>("gpt-3.5-turbo")
    .preamble("\n        You are a sentiment analysis AI. Classify the sentiment of the given text.\n        Examples:\n        Text: 'This movie was terrible. I hated every minute of it.'\n        Sentiment: Negative, Confidence: 0.9\n        Text: 'The weather today is okay, nothing special.'\n        Sentiment: Neutral, Confidence: 0.7\n        Text: 'I'm so excited about my upcoming vacation!'\n        Sentiment: Positive, Confidence: 0.95\n    ")
    .build();
```

--------------------------------

### Basic Rig Usage: Prompting OpenAI GPT-4

Source: https://docs.rig.rs/docs/quickstart/getting_started

This Rust code snippet demonstrates how to use the `rig` library to prompt OpenAI's GPT-4 model. It includes setting up the OpenAI client, building an agent with a preamble, and sending a prompt to the agent. The example requires the `OPENAI_API_KEY` environment variable to be set.

```rust
use rig::client::{CompletionClient, ProviderClient};
use rig::completion::Prompt;
use rig::providers::openai;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    // Create OpenAI client
    let client = openai::Client::from_env();

    // Create agent with a single context prompt
    let comedian_agent = client
        .agent("gpt-5.2")
        .preamble("You are a comedian here to entertain the user using humour and jokes.")
        .build();

    // Prompt the agent and print the response
    let response = comedian_agent.prompt("Entertain me!").await?;

    println!("{response}");

    Ok(())
}
```

--------------------------------

### Connect to SurrealDB

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

Establishes a connection to a SurrealDB instance. This example uses an in-memory database and sets the namespace and database context. It requires the `surrealdb` crate.

```rust
use surrealdb::Surreal;
use rig_surrealdb::Mem;

// ... inside an async function ...
let surreal = Surreal::new::<Mem>(()).await?;
surreal.use_ns("example").use_db("example").await?;

```

--------------------------------

### Unified API for OpenAI and Cohere LLM Providers in Rust

Source: https://docs.rig.rs/docs/why_rig

Demonstrates how to use Rig's unified API to interact with both OpenAI and Cohere LLM providers. This example initializes clients for each provider, selects a model, and sends a prompt, showcasing the consistent `prompt` method across different LLMs. It requires environment variables for API keys.

```rust
use rig::providers::{openai, cohere};
use rig::completion::Prompt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize OpenAI client using environment variables
    let openai_client = openai::Client::from_env();
    let gpt4 = openai_client.model("gpt-4").build();

    // Initialize Cohere client with API key from environment variable
    let cohere_client = cohere::Client::new(&std::env::var("COHERE_API_KEY")?);
    let command = cohere_client.model("command").build();

    // Use OpenAI's GPT-4 to explain quantum computing
    let gpt4_response = gpt4.prompt("Explain quantum computing in one sentence.").await?;
    println!("GPT-4: {}", gpt4_response);

    // Use Cohere's Command model to explain quantum computing
    let command_response = command.prompt("Explain quantum computing in one sentence.").await?;
    println!("Cohere Command: {}", command_response);

    Ok(())
}
```

--------------------------------

### Run a Tool Server (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Illustrates how to create and run a `ToolServer` in Rust using the `rig` crate. Tool servers are spawned Tokio tasks that handle tool requests via message passing, offering an alternative to traditional locking mechanisms like `Arc<RwLock<T>>`. This example shows how to initialize a server and add a tool to it.

```rust
use rig::tool::server::{ToolServer, ToolServerHandle};

let tool_server: ToolServerHandle = ToolServer::new()
    .tool(Adder) // add a tool
    .run();
```

--------------------------------

### Rust AWS Lambda Runtime Client for Event-Based Tasks

Source: https://docs.rig.rs/guides/deploy/Blog_1_aws_lambda

Shows the fundamental setup for a Rust function designed for event-driven tasks on AWS Lambda. It uses the 'lambda_runtime' and 'lambda_events' crates to process incoming event payloads, such as those triggered by S3 uploads.

```rust
use lambda_runtime::{handler_fn, Context};
use lambda_events::s3::S3Event;

async fn function_handler(event: S3Event, _ctx: Context) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Process the S3 event payload
    for record in event.records {
        println!("Processing object: {} from bucket: {}", record.s3.object.key, record.s3.bucket.name);
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    handler_fn(function_handler).await
}

```

--------------------------------

### Create Tool-Augmented Agent

Source: https://docs.rig.rs/docs/concepts/agent

Shows how to create an agent that can utilize tools. This example includes adding static tools and configuring dynamic tool retrieval based on context and a toolset.

```rust
use rig::{Agent, Tool};

// Create agent with tools
let agent = openai.agent("gpt-4")
    .preamble("You are a capable assistant with tools.")
    .tool(calculator)
    .tool(web_search)
    .dynamic_tools(2, tool_index, toolset)
    .build();
```

--------------------------------

### Custom Document Path Example (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This code snippet demonstrates how to load custom Markdown content for the Rig agent's knowledge base. It shows how to construct a file path to a custom document and then use the `load_md_content` function to read its content.

```rust
// Example
let my_doc_path = documents_dir.join("my_custom_doc.md");
let my_doc_content = Self::load_md_content(&my_doc_path)?;
```

--------------------------------

### Setup Rust Project for Concurrent Processing

Source: https://docs.rig.rs/examples/advanced/concurrent_processing

Initializes a new Rust project and adds necessary dependencies (rig-core, tokio) for concurrent LLM task processing. It also shows how to set the OpenAI API key environment variable.

```bash
cargo new rig-concurrent-processing
cd rig-concurrent-processing

# Add to Cargo.toml:
# [dependencies]
# rig-core = "0.1.0"
# tokio = { version = "1.0", features = ["full"] }

export OPENAI_API_KEY=your_api_key_here
```

--------------------------------

### Build and Run Rust Project

Source: https://docs.rig.rs/guides/advanced/flight_assistant

These commands are used to compile and execute a Rust project. 'cargo build' compiles the project and its dependencies, while 'cargo run' compiles and then runs the executable. Ensure you have Rust and Cargo installed.

```bash
cargo build
```

```bash
cargo run
```

--------------------------------

### Add Static Tools to an Agent (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Shows how to add static tools to an agent using the Rig RS library. Static tools are always available to the agent. This example demonstrates building an agent with a specific LLM provider ('gpt-4'), setting a preamble, and adding two tools: `Adder` and `Subtract`.

```rust
let agent = client
    .agent("gpt-4")
    .preamble("You are a calculator.")
    .tool(Adder)
    .tool(Subtract)
    .build();
```

--------------------------------

### Initialize Embedding Model

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

Initializes an embedding model using Rig's OpenAI provider. This example specifically uses the `text-embedding-3-small` model. Ensure your OpenAI API key is set in the environment variables.

```rust
use rig::providers::openai::Client;

// ... inside an async function ...
let openai_client = Client::from_env();
let model = openai_client.embedding_model(rig::providers::openai::TEXT_EMBEDDING_3_SMALL);

```

--------------------------------

### Create SurrealDB Vector Store

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

Creates a `SurrealVectorStore` instance. This example uses default settings, which include the 'cosine' distance function and a default table name. The embedding model and SurrealDB connection are required.

```rust
use rig_surrealdb::SurrealVectorStore;

// Assuming 'model' and 'surreal' are already initialized
let vector_store = SurrealVectorStore::with_defaults(model, surreal);

```

--------------------------------

### Integration with Agents in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Illustrates how to integrate the Rig Extractor as a tool within a larger agent system. This example shows creating an extractor for `StructuredData` and then adding it as a tool to an agent built by the client.

```rust
let data_extractor = client.extractor::<StructuredData>(model).build();
let agent = client.agent(model)
    .tool(data_extractor)
    .build();
```

--------------------------------

### Chain Sequential Operations in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Illustrates how to create a sequential pipeline by chaining multiple operations using the `map` combinator. Each operation in the chain takes the output of the previous one as its input. This example shows adding numbers, doubling the result, and converting it to a string.

```rust
use rig::pipeline::{self, Op};

let pipeline = pipeline::new()
    .map(|(x, y)| x + y)     // Add numbers
    .map(|z| z * 2)          // Double result
    .map(|n| n.to_string()); // Convert to string

let result = pipeline.call((5, 3)).await;
assert_eq!(result, "16");
```

--------------------------------

### Add Dynamic Tools to an Agent (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Demonstrates how to configure an agent to use dynamic tools in Rig RS. Dynamic tools are retrieved from a vector store based on the user's query, enabling more flexible and context-aware tool usage. This example shows how to specify the number of dynamic tools to retrieve, the vector store index, and the toolset.

```rust
let agent = client
    .agent("gpt-4")
    .preamble("You are a calculator.")
    .dynamic_tools(2, vector_store_index, toolset)
    .build();
```

--------------------------------

### Create a RAG Knowledge Base Agent in Rig RS

Source: https://docs.rig.rs/docs/concepts/agent

This example shows how to configure an agent for use as a knowledge base with dynamic context. It sets a preamble, specifies dynamic context size and the document store, and adjusts the temperature for knowledge retrieval.

```rust
let kb_agent = openai.agent("gpt-4")
    .preamble("You are a knowledge base assistant.")
    .dynamic_context(5, document_store)
    .temperature(0.3)
    .build();
```

--------------------------------

### Build RAG Pipeline with Parallel Operations in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Shows an example of building a Retrieval-Augmented Generation (RAG) pipeline. It utilizes the `parallel!` macro to execute document lookup and embedding queries concurrently. The results are then formatted and passed to an LLM for response generation.

```rust
use rig::pipeline::{self, Op};

let pipeline = pipeline::new()
    // Parallel: Query embedding & document lookup
    .chain(parallel!(
        passthrough(),
        lookup::<_, _, Document>(vector_store, 3)
    ))
    // Format context
    .map(|(query, docs)| format!(
        "Query: {}\nContext: {}",
        query,
        docs.join("\n")
    ))
    // Generate response
    .prompt(llm_model);
```

--------------------------------

### Create SurrealDB Vector Store with Custom Distance

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

Demonstrates creating a `SurrealVectorStore` with a custom distance function. This example uses the 'Jaccard' distance metric. You can choose from 'Cosine', 'Euclidean', 'Hamming', 'Jaccard', and 'Knn'.

```rust
use rig_surrealdb::{SurrealDistanceFunction, SurrealVectorStore};

// Assuming 'model' and 'surreal' are already initialized
let custom_store = SurrealVectorStore::new(
    model,
    surreal,
    Some("my_table".into()),
    SurrealDistanceFunction::Jaccard,
);

```

--------------------------------

### Query Vector Store for Similarity

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

Performs a top-N similarity search in the vector store using a natural language query. This example retrieves the top 3 most similar documents of type `WordDefinition`. The `VectorStoreIndex` trait is required.

```rust
use rig::vector_store::VectorStoreIndex;

// Assuming 'vector_store' is initialized
let results = vector_store.top_n::<WordDefinition>("what is glarb-glarb", 3).await?;

```

--------------------------------

### Integration with File Loaders in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Shows how to integrate Rig Extractors with file loading mechanisms. This example demonstrates reading multiple text files using `FileLoader`, then using an Extractor to process the content of each file and extract structured data.

```rust
let docs = FileLoader::with_glob("*.txt")?
    .read()
    .ignore_errors();

let extractor = client.extractor::<DocumentData>(model).build();

for doc in docs {
    let structured_data = extractor.extract(&doc).await?;
    // Process structured data
}
```

--------------------------------

### Inserting Embeddings into a Vector Store in Rust

Source: https://docs.rig.rs/docs/concepts/embeddings

Provides a conceptual example of how to insert generated embeddings into a vector store, such as Qdrant. This code snippet assumes the existence of a `create_qdrant_vector_store` function and uses the `InsertDocuments` trait.

```rust
use rig::vector_store::InsertDocuments;
// note: this function is pseudo-code
// look into specific crate integrations for more indepth
// usage explanations
let qdrant = create_qdrant_vector_store();

qdrant.insert_documents(embeddings).await?;
```

--------------------------------

### Deploy Rig Agent to AWS Lambda using cargo-lambda CLI

Source: https://docs.rig.rs/guides/deploy/Blog_1_aws_lambda

Demonstrates the command-line steps to build and deploy a Rust-based Rig agent application to AWS Lambda using the cargo-lambda CLI. It assumes AWS credentials are set up and the application code is in the 'rig-entertainer-lambda' directory.

```bash
# Add your AWS credentials to your terminal
# Create an AWS Lambda function named ‘rig-entertainer’ with architecture x86_64.

function_name='rig-entertainer'

cd rig-entertainer-lambda
cargo lambda build --release # Can define different architectures here with --arm64 for example
cargo lambda deploy $function_name # Since the name of the crate is the same as the the lambda function name, no need to specify a binary file

```

--------------------------------

### Create Extraction Pipeline in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Demonstrates how to create a pipeline for extracting structured data from text using the `extract` combinator. This example defines a `Sentiment` struct and uses an extractor to parse text into this structure, likely involving natural language processing.

```rust
use rig::pipeline::{self, Op};

#[derive(Deserialize, JsonSchema)]
struct Sentiment {
    score: f64,
    label: String,
}

let pipeline = pipeline::new()
    .map(|text| format!("Analyze sentiment: {}", text))
    .extract::<_, _, Sentiment>(extractor);
```

--------------------------------

### Basic File Loading with FileLoader

Source: https://docs.rig.rs/docs/concepts/loaders

A fundamental example of using FileLoader with a glob pattern to read text files. It iterates through the files, ignoring any read errors, and provides a basic structure for processing file content.

```rust
let loader = FileLoader::with_glob("data/*.txt")?;
for content in loader.read().ignore_errors() {
    // Process content
}
```

--------------------------------

### Update Embeddings Builder with Custom Document (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This example illustrates how to update the `EmbeddingsBuilder` to include custom documents in the Rig agent's knowledge base. It shows how to initialize the builder with an embedding model and add a custom document with a specified name and content.

```rust
let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
    .simple_document("My Custom Doc", &my_doc_content)
    .build()
    .await?;
```

--------------------------------

### Configure Rig Agent Dependencies in Cargo.toml

Source: https://docs.rig.rs/guides/deploy/Blog_1_aws_lambda

Specifies the necessary dependencies for a Rig agent application intended to run on AWS Lambda. This includes the core Rig crate, the AWS Lambda runtime client, and the Tokio asynchronous runtime.

```toml
[dependencies]
rig-core = "*"
lambda_runtime = "*"
tokio = "*"

```

--------------------------------

### OpenAI Client Initialization and Model Creation (Rust)

Source: https://docs.rig.rs/docs/integrations/model_providers/openai

Demonstrates how to create an OpenAI client using environment variables or an explicit API key. It also shows how to instantiate completion and embedding models.

```rust
use rig::providers::openai;

// Create client from environment variable
let client = openai::Client::from_env();

// Or explicitly with API key
let client = openai::Client::new("your-api-key");

// Create a completion model
let gpt4 = client.completion_model(openai::GPT_4);

// Create an embedding model
let embedder = client.embedding_model(openai::TEXT_EMBEDDING_3_LARGE);
```

--------------------------------

### Manual Embed Trait Implementation for Structs in Rust

Source: https://docs.rig.rs/docs/concepts/embeddings

Shows how to manually implement the `Embed` trait for a Rust struct when specific fields need custom embedding logic. This example embeds only the `name` field after converting it to owned string, and splits definitions if needed.

```rust
struct Foo {
    id: i32,
    name: String
}

impl Embed for WordDefinition {
    fn embed(&self, embedder: &mut TextEmbedder) -> Result<(), EmbedError> {
       // Embeddings only need to be generated for `definition` field.
       // Split the definitions by comma and collect them into a vector of strings.
       // That way, different embeddings can be generated for each definition in the `definitions` string.
       embedder.embed(self.name.to_owned());

       Ok(())
    }
}
```

--------------------------------

### Handle Fallible Batch Operations in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Provides an example of using `try_batch_call` for operations that might fail. This code snippet demonstrates calling an operation with a batch of inputs and asserting the expected successful output, implying that the operation is designed to handle potential errors gracefully.

```rust
let result = op.try_batch_call(2, vec![2, 4]).await;
assert_eq!(result, Ok(vec![3, 5]));
```

--------------------------------

### Convert Rig Message to Custom Message Type (Free-standing Function)

Source: https://docs.rig.rs/guides/extension/write_your_own_provider

Demonstrates a free-standing function in Rust to convert Rig's internal `Message` type to a custom `Message` type for a specific provider. This approach is useful when the orphan rule prevents implementing `TryFrom` directly. The example shows practical usage with `map` and `collect`.

```rust
fn convert_rig_message_to_my_message(message: rig::completion::Message) -> Result<Vec<Message>, MyError> {
    // .. some code
}

// practical usage
let messages: Vec<Message> = messages
    .into_iter()
    .map(convert_rig_message_to_my_message)
    .collect::<Result<Vec<Message>, MyError>>()?
    .into_iter()
    .flatten()
    .collect();
```

--------------------------------

### Rust AWS Lambda Runtime Client for REST APIs

Source: https://docs.rig.rs/guides/deploy/Blog_1_aws_lambda

Illustrates the basic structure for a Rust function intended to serve as a REST API backend on AWS Lambda. It utilizes the 'lambda-http' crate for handling HTTP requests and responses, and 'axum' for routing if multiple endpoints are managed within the Lambda.

```rust
use lambda_http::{request, response, Body, IntoResponse, RequestExt, Response};

#[tokio::main]
async fn main() -> Result<(), std::boxed::Box<dyn std::error::Error + Send + Sync>> {
    lambda_runtime::run(handler).await?;    Ok(())
}

async fn handler(req: request::Request) -> impl IntoResponse {
    // Your API logic here
    let resp = Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(Body::from("Hello from Lambda!"))
        .expect("Failed to create response");
    resp
}

```

--------------------------------

### CloudWatch Logs Query for Lambda Performance Metrics

Source: https://docs.rig.rs/guides/deploy/Blog_2_aws_lambda_lancedb

This CloudWatch Logs Insights query aggregates performance metrics for Lambda functions, including average and maximum duration, memory usage, and cold start times. It groups results by day and memory configuration, providing insights into performance variations across different settings.

```CloudWatch Logs Insights
filter @type = "REPORT" 
| stats
      avg(@maxMemoryUsed) / 1000000 as MemoryUsageMB,
      avg(@duration) / 1000 as AvgDurationSec,
      max(@duration) / 1000 as MaxDurationSec,
      min(@duration) / 1000 as MinDurationSec,
      avg(@initDuration) / 1000 as AvgColdStartTimeSec,
      count(*) as NumberOfInvocations,
      sum(@initDuration > 0) as ColdStartInvocations
by bin(1d) as TimeRange, @memorySize / 1000000 as MemoryConfigurationMB
```

--------------------------------

### Create Basic Agent with OpenAI

Source: https://docs.rig.rs/docs/concepts/agent

Demonstrates the creation of a simple agent using the OpenAI provider. It initializes an OpenAI client, sets a system prompt and temperature, and builds the agent for use.

```rust
use rig::{providers::openai, Agent};

let openai = openai::Client::from_env();

// Create simple agent
let agent = openai.agent("gpt-4")
    .preamble("You are a helpful assistant.")
    .temperature(0.7)
    .build();

// Use the agent
let response = agent.prompt("Hello!").await?;
```

--------------------------------

### Connect to Qdrant and Create Collection using Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/qdrant

Demonstrates establishing a connection to a Qdrant instance and creating a new collection if it doesn't already exist. It configures vector parameters including size and distance metric.

```rust
let qdrant_client = Qdrant::connect("http://localhost:6334").await?;

if !qdrant_client.collection_exists(COLLECTION_NAME).await? {
    qdrant_client.create_collection(
        CreateCollectionBuilder::new(COLLECTION_NAME)
            .vectors_config(VectorParamsBuilder::new(
                COLLECTION_SIZE as u64,
                qdrant_client::qdrant::Distance::Cosine)
            ),
        ).await?;
}

```

--------------------------------

### Build Anthropic Client and Models with Rig

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Demonstrates how to initialize the Anthropic client using ClientBuilder, configure API version and beta features, and create completion models or agents. Requires the 'rig' crate.

```rust
use rig::providers::anthropic::{ClientBuilder, CLAUDE_3_SONNET};

// Create client with specific version and beta features
let client = ClientBuilder::new("your-api-key")
    .anthropic_version("2023-06-01")
    .anthropic_beta("prompt-caching-2024-07-31")
    .build();

// Create a completion model
let claude = client.completion_model(CLAUDE_3_SONNET);

// Or create an agent directly
let agent = client
    .agent(CLAUDE_3_SONNET)
    .preamble("You are a helpful assistant")
    .build();
```

--------------------------------

### Create New Rust Project and Add Dependencies

Source: https://docs.rig.rs/guides/text_extraction_classification

This snippet shows how to create a new Rust project using Cargo and lists the necessary dependencies for building an LLM application with Rig, including Rig core, Tokio for async operations, and Serde for JSON handling.

```bash
cargo new text_classifier_extractor
cd text_classifier_extractor
```

```toml
[package]
name = "text_classifier_extractor"
version = "0.1.0"
edition = "2021"
 
[dependencies]
rig-core = "0.11.1"
tokio = { version = "1.34.0", features = ["full"] }
anyhow = "1.0.75"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

--------------------------------

### Initialize Rig Agent with OpenAI and Vector Store (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

Initializes the `RigAgent` by setting up the OpenAI client, creating an in-memory vector store, loading markdown documents, building embeddings, and configuring a RAG agent with a specific preamble and dynamic context. This function is crucial for setting up the agent's knowledge base and conversational capabilities.

```rust
// rig_agent.rs

use anyhow::{Context, Result};
use rig::providers::openai;
use rig::vector_store::in_memory_store::InMemoryVectorStore;
use rig::embeddings::EmbeddingsBuilder;
use rig::rag::RagAgent;
use std::path::Path;
use std::fs;
use std::sync::Arc;


pub struct RigAgent {
    rag_agent: Arc<RagAgent<openai::CompletionModel, rig::vector_store::InMemoryVectorIndex<openai::EmbeddingModel>, rig::vector_store::NoIndex>>,
}

impl RigAgent {
    pub async fn new() -> Result<Self> {
        // Initialize OpenAI client
        let openai_client = openai::Client::from_env();
        let embedding_model = openai_client.embedding_model("text-embedding-3-small");

        // Create vector store
        let mut vector_store = InMemoryVectorStore::default();

        // Get the current directory and construct paths to markdown files
        let current_dir = std::env::current_dir()?;
        let documents_dir = current_dir.join("documents");

        let md1_path = documents_dir.join("Rig_guide.md");
        let md2_path = documents_dir.join("Rig_faq.md");
        let md3_path = documents_dir.join("Rig_examples.md");

        // Load markdown documents
        let md1_content = Self::load_md_content(&md1_path)?;
        let md2_content = Self::load_md_content(&md2_path)?;
        let md3_content = Self::load_md_content(&md3_path)?;

        // Create embeddings and add to vector store
        let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
            .simple_document("Rig_guide", &md1_content)
            .simple_document("Rig_faq", &md2_content)
            .simple_document("Rig_examples", &md3_content)
            .build()
            .await?;

        vector_store.add_documents(embeddings).await?;

        // Create index
        let context_index = vector_store.index(embedding_model);

        // Create RAG agent
        let rag_agent = Arc::new(openai_client.context_rag_agent("gpt-4")
            .preamble("You are an advanced AI assistant powered by [Rig](https://rig.rs/), a Rust library for building LLM applications. Your primary function is to provide accurate, helpful, and context-aware responses by leveraging both your general knowledge and specific information retrieved from a curated knowledge base.

                    Key responsibilities and behaviors:
                    1. Information Retrieval: You have access to a vast knowledge base. When answering questions, always consider the context provided by the retrieved information.
                    2. Clarity and Conciseness: Provide clear and concise answers. Ensure responses are short and to the point. Use bullet points or numbered lists for complex information when appropriate.
                    3. Technical Proficiency: You have deep knowledge about Rig and its capabilities. When discussing Rig or answering related questions, provide detailed and technically accurate information.
                    4. Code Examples: When appropriate, provide Rust code examples to illustrate concepts, especially when discussing Rig's functionalities. Always format code examples for proper rendering in Discord by wrapping them in triple backticks and specifying the language as 'rust'. For example:
                        ```rust
                        let example_code = \"This is how you format Rust code for Discord\";
                        println!(\"{}\", example_code);
                        ```
                    ")
            .dynamic_context(2, context_index)
            .build());

        Ok(Self { rag_agent })
    }

    pub async fn process_message(&self, message: &str) -> Result<String> {
        self.rag_agent.prompt(message).await.map_err(anyhow::Error::from)
    }
}

```

--------------------------------

### Initialize QdrantVectorStore and Perform Top-N Search in Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/qdrant

This code initializes a QdrantVectorStore with a specified model and query parameters, then performs a top-N similarity search against the vector index. It returns results of a specified type.

```rust
let query_params = QueryPointsBuilder::new(COLLECTION_NAME).with_payload(true);
let vector_store = QdrantVectorStore::new(qdrant_inner, model.clone(), query_params.build());

let results = vector_store.top_n::<Movie>("a historical movie on quebec", 5).await?;

```

--------------------------------

### Build RAG System with Rig and OpenAI

Source: https://docs.rig.rs/guides/rag/rag_system

This Rust code snippet demonstrates the complete implementation of a RAG system using Rig 0.24.0. It initializes an OpenAI client, loads content from PDF files, creates embeddings, builds an in-memory vector store, and sets up a CLI chatbot powered by an OpenAI agent. Dependencies include 'rig', 'tokio', 'anyhow', and 'pdf_extract'.

```rust
use rig::providers::openai;
use rig::integrations::cli_chatbot::ChatBotBuilder;
use rig::vector_store::in_memory_store::InMemoryVectorStore;
use rig::embeddings::EmbeddingsBuilder;
use rig::client::{EmbeddingsClient, CompletionsClient};
use rig::cli_chatbot::cli_chatbot;
use std::path::Path;
use anyhow::{Result, Context};
use pdf_extract::extract_text;

fn load_pdf_content<P: AsRef<Path>>(file_path: P) -> Result<String> {
    extract_text(file_path.as_ref())
        .with_context(|| format!("Failed to extract text from PDF: {:?}", file_path.as_ref()))
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize OpenAI client
    let openai_client = openai::Client::from_env();
    let embedding_model = openai_client.embedding_model("text-embedding-ada-002");

    // Get the current directory and construct paths to PDF files
    let current_dir = std::env::current_dir()?;
    let documents_dir = current_dir.join("documents");

    let pdf1_path = documents_dir.join("Moores_Law_for_Everything.pdf");
    let pdf2_path = documents_dir.join("The_Last_Question.pdf");

    // Load PDF documents
    let pdf1_content = load_pdf_content(&pdf1_path)?;
    let pdf2_content = load_pdf_content(&pdf2_path)?;

    // Create embeddings and vector store
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .simple_document("Moores_Law_for_Everything", &pdf1_content)
        .simple_document("The_Last_Question", &pdf2_content)
        .build()
        .await?;

    let vector_store = InMemoryVectorStore::from_documents(embeddings);

    // Create index
    let index = vector_store.index(embedding_model);

    // Create RAG agent
    let rag_agent = openai_client
        .agent("gpt-3.5-turbo")
        .preamble("You are a helpful assistant that answers questions based on the given context from PDF documents.")
        .dynamic_context(2, index)
        .build();

    // Create a CLI chatbot from the agent
    let chatbot = ChatBotBuilder::new().agent(rag_agent).build();

    chatbot.run().await?;

    Ok(())
}

```

--------------------------------

### Initialize and Search Local LanceDB Vector Store

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Demonstrates initializing a LanceDB vector store using local storage and performing a top-N similarity search. It requires the `rig_lancedb` crate and `lancedb` client.

```rust
use rig_lancedb::{LanceDbVectorIndex, SearchParams};
 
// Initialize local database
let db = lancedb::connect("data/lancedb-store").execute().await?;
 
// Create vector index
let vector_store = LanceDbVectorIndex::new(
    table,
    model,
    "id",
    SearchParams::default()
).await?;
 
// Perform search
let results = vector_store
    .top_n::<Document>("search query", 5)
    .await?;
```

--------------------------------

### Connect to Neo4j using Neo4jClient

Source: https://docs.rig.rs/docs/integrations/vector_stores/neo4j

Demonstrates how to establish a connection to a Neo4j database using the Neo4jClient. This is a prerequisite for interacting with Neo4j for vector storage and search operations.

```rust
let neo4j_client = Neo4jClient::connect("neo4j://localhost:7687", "username", "password").await?;

```

--------------------------------

### Completion API - Usage Patterns

Source: https://docs.rig.rs/docs/concepts/completion

Illustrates common ways to use the Completion API, from basic prompts to advanced configurations with tools and context.

```APIDOC
## Usage Patterns

### Basic Completion
Performs a simple text generation task.

```rust
// Assuming 'client' is an initialized Client instance and 'api_key' is valid
// let client = Client::new(api_key);
// let model = client.completion_model("gpt-4");

// let response = model
//     .prompt("Explain quantum computing")
//     .await?;
```

### Contextual Chat
Engages in a conversational flow using chat history.

```rust
// Assuming 'model' is an initialized completion model
// let chat_response = model
//     .chat(
//         "Continue the discussion",
//         vec![Message::user("Previous context")]
//     )
//     .await?;
```

### Advanced Request Configuration
Sends a request with detailed configurations including preamble, temperature, documents, and tools.

```rust
// Assuming 'model' is an initialized completion model, 'context' is document data,
// and 'available_tools' is a list of tool definitions
// let request = model
//     .completion_request("Complex query")
//     .preamble("Expert system")
//     .temperature(0.8)
//     .documents(context)
//     .tools(available_tools)
//     .send()
//     .await?;
```
```

--------------------------------

### Rust Initialize OpenAI Client

Source: https://docs.rig.rs/guides/rag/rag_system

Initializes the OpenAI client using Rig's `openai::Client::from_env()`. This client is used to interact with the OpenAI API for embedding generation within the RAG system.

```rust
let openai_client = openai::Client::from_env();
```

--------------------------------

### Securely Load Environment Variables for API Keys

Source: https://docs.rig.rs/guides/text_extraction_classification

Demonstrates how to manage sensitive API keys using environment variables. It includes creating a .env file, adding it to .gitignore, and using the `dotenv` crate in Rust to load these variables at runtime, ensuring keys are not hardcoded.

```text
# .gitignore
.env
```

```toml
dotenv = "0.15.0"
```

```rust
dotenv::dotenv().ok();
```

--------------------------------

### Initialize OpenAI and MongoDB Clients and Embed Documents (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/mongodb

This snippet initializes clients for OpenAI and MongoDB, then prepares to embed and store document data. It requires OPENAI_API_KEY and MONGODB_CONNECTION_STRING environment variables. The output is a set of embedded documents ready for storage.

```rust
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    // Initialize OpenAI client
    let openai_api_key = env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY not set");
    let openai_client = Client::new(&openai_api_key);

    // Initialize MongoDB client
    let mongodb_connection_string =
        env::var("MONGODB_CONNECTION_STRING").expect("MONGODB_CONNECTION_STRING not set");
    let options = ClientOptions::parse(mongodb_connection_string)
        .await
        .expect("MongoDB connection string should be valid");

    let mongodb_client =
        MongoClient::with_options(options).expect("MongoDB client options should be valid");

    // Initialize MongoDB vector store
    let collection: Collection<bson::Document> = mongodb_client
        .database("knowledgebase")
        .collection("context");

    // Select the embedding model and generate our embeddings
    let model = openai_client.embedding_model(TEXT_EMBEDDING_ADA_002);

    let words = vec![
        Word {
            id: "doc0".to_string(),
            definition: "Definition of a *flurbo*: A flurbo is a green alien that lives on cold planets".to_string(),
        },
        Word {
            id: "doc1".to_string(),
            definition: "Definition of a *glarb-glarb*: A glarb-glarb is a ancient tool used by the ancestors of the inhabitants of planet Jiro to farm the land.".to_string(),
        },
        Word {
            id: "doc2".to_string(),
            definition: "Definition of a *linglingdong*: A term used by inhabitants of the far side of the moon to describe humans.".to_string(),
        }
    ];

    // ... rest of the embedding and search logic ...

    Ok(())
}

```

--------------------------------

### Initialize and Run Discord Bot Client (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This code sets up and runs a Discord bot client using Rust. It handles environment variable loading for the bot token, initializes tracing for logging, and configures gateway intents. It requires 'tokio', 'dotenv', and 'serenity' crates.

```rust
#[tokio::main]
async fn main() -> Result<()>
{
    dotenv().ok();

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    let token = env::var("DISCORD_TOKEN").expect("Expected DISCORD_TOKEN in environment");

    let rig_agent = Arc::new(RigAgent::new().await?);

    let intents = GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::DIRECT_MESSAGES
        | GatewayIntents::MESSAGE_CONTENT;

    let mut client = Client::builder(&token, intents)
        .event_handler(Handler {
            rig_agent: Arc::clone(&rig_agent),
        })
        .await
        .expect("Err creating client");

    if let Err(why) = client.start().await {
        error!("Client error: {:?}", why);
    }

    Ok(())
}
```

--------------------------------

### Implement Rig Agent Initialization Method (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

Initializes the Rig agent by setting up the OpenAI client, creating a vector store, loading and embedding knowledge base documents, and building the RAG agent. It uses `Arc` for thread-safe sharing of the `RigAgent` across asynchronous operations.

```rust
impl RigAgent {
    pub async fn new() -> Result<Self> {
        // Initialize OpenAI client
        let openai_client = openai::Client::from_env();
        let embedding_model = openai_client.embedding_model("text-embedding-3-small");
 
        // Create vector store
        let mut vector_store = InMemoryVectorStore::default();
 
        // Get the current directory and construct paths to markdown files
        let current_dir = std::env::current_dir()?;
        let documents_dir = current_dir.join("documents");
 
        let md1_path = documents_dir.join("Rig_guide.md");
        let md2_path = documents_dir.join("Rig_faq.md");
        let md3_path = documents_dir.join("Rig_examples.md");
 
        // Load markdown documents
        let md1_content = Self::load_md_content(&md1_path)?;
        let md2_content = Self::load_md_content(&md2_path)?;
        let md3_content = Self::load_md_content(&md3_path)?;
 
        // Create embeddings and add to vector store
        let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
            .simple_document("Rig_guide", &md1_content)
            .simple_document("Rig_faq", &md2_content)
            .simple_document("Rig_examples", &md3_content)
            .build()
            .await?;
 
        vector_store.add_documents(embeddings).await?;
 
        // Create index
        let context_index = vector_store.index(embedding_model);
 
        // Create RAG agent
        let rag_agent = Arc::new(openai_client.context_rag_agent("gpt-4")
            .preamble("You are an advanced AI assistant powered by [Rig](https://rig.rs/), a Rust library for building LLM applications. Your primary function is to provide accurate, helpful, and context-aware responses by leveraging both your general knowledge and specific information retrieved from a curated knowledge base.

                    Key responsibilities and behaviors:
                    1. Information Retrieval: You have access to a vast knowledge base. When answering questions, always consider the context provided by the retrieved information.
                    2. Clarity and Conciseness: Provide clear and concise answers. Ensure responses are short and to the point. Use bullet points or numbered lists for complex information when appropriate.
                    3. Technical Proficiency: You have deep knowledge about Rig and its capabilities. When discussing Rig or answering related questions, provide detailed and technically accurate information.
                    4. Code Examples: When appropriate, provide Rust code examples to illustrate concepts, especially when discussing Rig's functionalities. Always format code examples for proper rendering in Discord by wrapping them in triple backticks and specifying the language as 'rust'. For example:
                        `\`\`rust
                        let example_code = \"This is how you format Rust code for Discord\";
                        println!(\"{}\", example_code);
                        `\`\`
                    ")
            .dynamic_context(2, context_index)
            .build());
 
        Ok(Self { rag_agent })
    }

    // ... we'll add more code here as we build things out
}
```

--------------------------------

### Initialize and Run Flight Search Agent in Rust

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This Rust code snippet initializes an OpenAI client, creates an AI agent with a flight search tool, and prompts it to find flights. It requires the 'rig', 'tokio', and 'dotenv' crates. The input is a natural language query, and the output is the agent's response, typically flight details.

```rust
mod flight_search_tool;

use crate::flight_search_tool::FlightSearchTool;
use dotenv::dotenv;
use rig::completion::Prompt;
use rig::providers::openai;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv().ok();

    let openai_client = openai::Client::from_env();

    let agent = openai_client
        .agent("gpt-4")
        .preamble("You are a helpful assistant that can find flights for users.")
        .tool(FlightSearchTool)
        .build();

    let response = agent
        .prompt("Find me flights from San Antonio (SAT) to Atlanta (ATL) on November 15th 2024.")
        .await?;

    println!("Agent response:\n{}", response);

    Ok(())
}
```

--------------------------------

### Initialize New Rust Project with Cargo

Source: https://docs.rig.rs/guides/advanced/discord_bot

Creates a new Rust project named 'discord_rig_bot' and changes the current directory to the newly created project folder using Cargo commands.

```bash
cargo new discord_rig_bot
cd discord_rig_bot
```

--------------------------------

### Implement News Article Analyzer with OpenAI (Rust)

Source: https://docs.rig.rs/guides/text_extraction_classification

Implements the main function to perform news article analysis using OpenAI's GPT-4 via the Rig library. It sets up the OpenAI client, configures the news analyzer with a detailed preamble, extracts information from a sample article, and prints the structured analysis results. Error handling for API calls and result processing is included.

```rust
#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();
    let openai_client = openai::Client::from_env()?;

    let news_analyzer = openai_client
        .extractor::<NewsArticleAnalysis>("gpt-4")
        .preamble("\n            You are a news article analysis AI. For the given news article:\n            1. Classify the main topic (Politics, Technology, Sports, Entertainment, or Other).\n            2. Analyze the overall sentiment (Positive, Negative, or Neutral) with a confidence score.\n            3. Identify and extract named entities (Person, Organization, Location) with their start and end indices.\n            4. Extract 3-5 key points from the article.\n        ")
        .build();

    let article = "/* Article text here */";

    let result = news_analyzer.extract(article).await?;

    println!("Article Analysis:");
    println!("Topic: {:?}", result.topic);
    println!("Sentiment: {:?} (Confidence: {:.2})", result.sentiment.sentiment, result.sentiment.confidence);
    println!("\nEntities:");
    for entity in &result.entities {
        println!(
            "- {:?}: {} ({}:{})",
            entity.entity_type, entity.text, entity.start, entity.end
        );
    }
    println!("\nKey Points:");
    for (i, point) in result.key_points.iter().enumerate() {
        println!("{}. {}", i + 1, point);
    }

    Ok(())
}

```

--------------------------------

### Initialize Bot, Set Commands, and Store User ID (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This Rust function handles the 'ready' event, which is triggered when the bot connects to Discord. It logs the bot's connection, stores the bot's user ID in the TypeMap for later use, and sets up global slash commands ('hello' and 'ask'). It prints the created commands for debugging.

```Rust
async fn ready(&self, ctx: Context, ready: Ready) {
    info!("{} is connected!", ready.user.name);
 
    {
        let mut data = ctx.data.write().await;
        data.insert::<BotUserId>(ready.user.id);
    }
 
    let commands = Command::set_global_application_commands(&ctx.http, |commands| {
        commands
            .create_application_command(|command| {
                command
                    .name("hello")
                    .description("Say hello to the bot")
            })
            .create_application_command(|command| {
                command
                    .name("ask")
                    .description("Ask the bot a question")
                    .create_option(|option| {
                        option
                            .name("query")
                            .description("Your question for the bot")
                            .kind(CommandOptionType::String)
                            .required(true)
                    })
            })
    })
    .await;
 
    println!("Created the following global commands: {:#?}", commands);
}
```

--------------------------------

### Import Libraries for Flight Search Tool

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This Rust code snippet imports necessary libraries for building the flight search tool. It includes modules for date and time handling, Rig's Tool and ToolDefinition, serialization, JSON manipulation, hash maps, and environment variable access.

```rust
use chrono::{DateTime, Duration, Utc};
use rig::completion::ToolDefinition;
use rig::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
```

--------------------------------

### Initialize MCP Client (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Initializes an MCP client to connect to an MCP server and fetch tool metadata. It sets up the transport layer and client information, then serves the client connection.

```rust
let transport = 
    rmcp::transport::StreamableHttpClientTransport::from_uri("http://localhost:8080");
 
let client_info = ClientInfo {
    protocol_version: Default::default(),
    capabilities: ClientCapabilities::default(),
    client_info: Implementation {
        name: "rig-core".to_string(),
        version: "0.23.0".to_string(),
    },
};

let client = client_info.serve(transport).await.inspect_err(|e| {
    tracing::error!("client error: {:?}", e);
})?;
```

--------------------------------

### Initialize and Search MongoDB Vector Store (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/mongodb

Demonstrates how to initialize the MongoDbVectorIndex with a collection, embedding model, index name, and search parameters, followed by performing a top-N similarity search for documents.

```rust
use rig_mongodb::{MongoDbVectorIndex, SearchParams};
use rig_core::document::Document;

// Initialize the vector store
let index = MongoDbVectorIndex::new(
    collection,
    embedding_model,
    "vector_index",
    SearchParams::new()
).await?;

// Search for similar documents
let results = index.top_n::<Document>("search query", 5).await?;
```

--------------------------------

### Implement Conversion Traits for Client

Source: https://docs.rig.rs/guides/extension/write_your_own_provider

This macro simplifies the implementation of various conversion traits for a Client struct. It takes a list of traits to implement and the Client type. This is useful when a model provider supports only a subset of the available functionalities.

```Rust
impl_conversion_traits!(
    AsTranscription,
    AsImageGeneration,
    AsAudioGeneration for Client
);

```

--------------------------------

### Test Rig Agent Independently in Rust

Source: https://docs.rig.rs/guides/advanced/discord_bot

Demonstrates how to test the `RigAgent` independently before full Discord integration. It initializes the agent, processes a sample message, and prints the response. This helps verify the agent's core logic and its ability to interact with the knowledge base.

```rust
// Test the RigAgent in main.rs

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let rig_agent = RigAgent::new().await?;
    let response = rig_agent.process_message("What is Rig?").await?;
    println!("Response: {}", response);

    Ok(())
}
```

--------------------------------

### Implement Embedding Model and Load PDF Documents (Rust)

Source: https://docs.rig.rs/guides/rag/rag_system

Sets up an embedding model using OpenAI's text-embedding-ada-002, loads content from PDF files, generates embeddings for the content, and creates an in-memory vector store. Requires the 'rig' crate and assumes the existence of PDF files in a 'documents' directory.

```rust
use rig::embeddings::EmbeddingsBuilder;
use rig::client::EmbeddingsClient;
use rig::vector_store::InMemoryVectorStore;
use std::env;
 
// Create an embedding model using OpenAI's text-embedding-ada-002
let embedding_model = openai_client.embedding_model("text-embedding-ada-002");
 
// Get the current directory and construct paths to PDF files
let current_dir = env::current_dir()?;
let documents_dir = current_dir.join("documents");
 
let pdf1_path = documents_dir.join("Moores_Law_for_Everything.pdf");
let pdf2_path = documents_dir.join("The_Last_Question.pdf");
 
// Load PDF documents
let pdf1_content = load_pdf_content(&pdf1_path)?;
let pdf2_content = load_pdf_content(&pdf2_path)?;
 
// Create embeddings for the PDF contents
let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
    .simple_document("Moores_Law_for_Everything", &pdf1_content)
    .simple_document("The_Last_Question", &pdf2_content)
    .build()
    .await?;
 
// Create vector store from documents
let vector_store = InMemoryVectorStore::from_documents(embeddings);
```

--------------------------------

### List MCP Tools (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Retrieves a list of available tools from an initialized MCP client. The tools are then printed to the console for inspection.

```rust
let tools: Vec<Tool> = client.list_tools(Default::default()).await?.tools;

println!("Tools: {:?}", tools);
```

--------------------------------

### Initialize Logging with Tracing in Rust

Source: https://docs.rig.rs/guides/advanced/discord_bot

Sets up the `tracing` crate for flexible logging in a Rust application. It configures the subscriber to capture messages from DEBUG level upwards, allowing detailed insights into the bot's operation. This is typically done once at the application's entry point.

```rust
use tracing::{info, error, debug};
use tracing_subscriber;

// Initialize tracing in main.rs
tracing_subscriber::fmt()
    .with_max_level(tracing::Level::DEBUG)
    .init();
```

--------------------------------

### Run MCP Server (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Sets up and runs an MCP server using the `CalculatorServer` definition. It binds the server to a local address and port, making it available for MCP clients to connect and invoke tools.

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let server = CalculatorServer;

    let transport = rmcp::transport::StreamableHttpServerTransport::new(
        "127.0.0.1:8080".parse()?
    );

    server.serve(transport).await?;

    Ok(())
}
```

--------------------------------

### Completion API - Best Practices

Source: https://docs.rig.rs/docs/concepts/completion

Recommends best practices for using the Completion API effectively, focusing on interface selection, error handling, and resource management.

```APIDOC
## Best Practices

### Interface Selection
- Use `Prompt` for simple, single-turn interactions.
- Use `Chat` for multi-turn conversational flows.
- Use `Completion` for fine-grained control over request parameters.

### Error Handling
- Implement robust handling for provider-specific errors.
- Design graceful fallback mechanisms for failures.
- Log raw responses for effective debugging.

### Resource Management
- Reuse model instances to avoid repeated initialization overhead.
- Batch similar requests where possible to improve efficiency.
- Monitor token usage to manage costs and performance.
```

--------------------------------

### Add Documents with Auto-Generated IDs (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

Demonstrates how to initialize an InMemoryVectorStore by providing a vector of documents and their corresponding embeddings, where document IDs are automatically generated.

```rust
let store = InMemoryVectorStore::from_documents(vec![
    (doc1, embedding1),
    (doc2, embedding2)
]);
```

--------------------------------

### Implement CompletionClient Trait

Source: https://docs.rig.rs/guides/extension/write_your_own_provider

This code demonstrates how to implement the `CompletionClient` trait for a custom client struct. It defines the associated `CompletionModel` type and provides an implementation for the `completion_model` method, which returns an instance of the model.

```Rust
impl CompletionClient for MyProviderClient {
    type CompletionModel = CompletionModel;

    fn completion_model(&self, model: &str) -> Self::CompletionModel {
        CompletionModel { client: self.clone(), model_name: model.to_string() }
    }
}

struct CompletionModel {
    client: Client,
    model_name: String
}

```

--------------------------------

### Import Rig Agent and Serenity Modules (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This code snippet shows the necessary imports for integrating the Rig agent with a Discord bot using the Serenity library in `main.rs`. It includes modules for `anyhow`, `serenity`, `std::env`, `std::sync::Arc`, `tracing`, the `RigAgent`, and `dotenv`.

```rust
// main.rs

mod rig_agent;

use anyhow::Result;
use serenity::async_trait;
use serenity::model::application::command::Command;
use serenity::model::application::interaction::{Interaction, InteractionResponseType};
use serenity::model::gateway::Ready;
use serenity::model::channel::Message;
use serenity::prelude::*;
use serenity::model::application::command::CommandOptionType;
use std::env;
use std::sync::Arc;
use tracing::{error, info, debug};
use rig_agent::RigAgent;
use dotenv::dotenv;
```

--------------------------------

### Add Documents with Custom IDs (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

Shows how to add documents to an InMemoryVectorStore using explicitly provided custom string IDs. This allows for precise control over document identification.

```rust
let store = InMemoryVectorStore::from_documents_with_ids(vec![
    ("custom_id_1", doc1, embedding1),
    ("custom_id_2", doc2, embedding2)
]);
```

--------------------------------

### Anthropic Client Builder Configuration

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Shows the structure and initialization of the Anthropic ClientBuilder in Rig, allowing configuration of API key, base URL, API version, and beta features.

```rust
const ANTHROPIC_API_BASE_URL: &str = "https://api.anthropic.com";

#[derive(Clone)]
pub struct ClientBuilder<'a> {
    api_key: &'a str,
    base_url: &'a str,
    anthropic_version: &'a str,
    anthropic_betas: Option<Vec<&'a str>>,
}

/// Create a new anthropic client using the builder
///
/// # Example
/// ```
/// use rig::providers::anthropic::{ClientBuilder, self};
///
/// // Initialize the Anthropic client
/// let anthropic_client = ClientBuilder::new("your-claude-api-key")
///    .anthropic_version(ANTHROPIC_VERSION_LATEST)
///    .anthropic_beta("prompt-caching-2024-07-31")
///    .build()
/// ```
impl<'a> ClientBuilder<'a> {
    pub fn new(api_key: &'a str) -> Self {
        Self {
            api_key,

```

--------------------------------

### Create Neo4j Vector Index

Source: https://docs.rig.rs/docs/integrations/vector_stores/neo4j

Illustrates the process of creating a vector index in Neo4j using the Neo4jClient. This involves specifying index configuration, the node label, and the embedding model to be used.

```rust
neo4j_client.create_vector_index(
    IndexConfig::new("moviePlots"),
    "Movie",
    &model
).await?;

```

--------------------------------

### Template for Contributing a New Vector Store Integration

Source: https://docs.rig.rs/docs/integrations

This is a template provided for users wishing to contribute a new vector store integration. It outlines the information required, including a description of the vector store and relevant resources.

```markdown
## Vector Store Integration Request
<!--
Describe the vector store and the features it provides (e.g.: is it cloud only? a plugin to an existing database? document-based or relational? etc.)
-->

### Resources
<!--
Links to API docs, SDKs or any other information that would help in the integration of the new vector store.
-->
```

--------------------------------

### Create and Run CLI Chatbot Interface (Rust)

Source: https://docs.rig.rs/guides/rag/rag_system

Initializes and runs an interactive command-line interface (CLI) chatbot using Rig's ChatBotBuilder. This function takes a pre-built RAG agent and provides a user-friendly chat interface with history management. Requires an initialized RAG agent.

```rust
use rig::integrations::cli_chatbot::ChatBotBuilder;
 
// Create a CLI chatbot from the agent
let chatbot = ChatBotBuilder::new().agent(rag_agent).build();
 
chatbot.run().await?;
```

--------------------------------

### Perform Basic Completion (Rust)

Source: https://docs.rig.rs/docs/concepts/completion

Demonstrates a basic completion request using the Rig RS client. It initializes a client, selects a completion model, and sends a simple prompt.

```rust
let openai = Client::new(api_key);
let model = openai.completion_model("gpt-4");

let response = model
    .prompt("Explain quantum computing")
    .await?;
```

--------------------------------

### Update Cargo.toml Dependencies

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This snippet shows the necessary dependencies to add to the Cargo.toml file for the flight search assistant project. It includes core Rig libraries, asynchronous runtime, serialization, HTTP client, environment variable loading, error handling, and date/time utilities.

```toml
[package]
name = "flight_search_assistant"
version = "0.1.0"
edition = "2021"

[dependencies]
rig-core = "0.1.0"
tokio = { version = "1.34.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
reqwest = { version = "0.11", features = ["json", "tls"] }
dotenv = "0.15"
thiserror = "1.0"
chrono = { version = "0.4", features = ["serde"] }
```

--------------------------------

### Set Up Environment Variables for Bot (dotenv)

Source: https://docs.rig.rs/guides/advanced/discord_bot

Defines the necessary environment variables for the Discord bot to run. This includes the Discord bot token and the OpenAI API key. These should be stored in a `.env` file and kept out of version control.

```env
DISCORD_TOKEN=your_discord_bot_token
OPENAI_API_KEY=your_openai_api_key
```

--------------------------------

### Supported Model Providers in Rig Core

Source: https://docs.rig.rs/docs/integrations

This snippet lists the currently supported model providers integrated directly into the `rig-core` library's `providers` module. It serves as a quick reference for available AI model services.

```rust
// Currently, the following providers are supported:
// - Cohere
// - OpenAI
// - Perplexity
// - Anthropic
// - Google Gemini
// - xAI
// - EternalAI
// - DeepSeek
// - Azure OpenAI
// - Mira
```

--------------------------------

### Build a Conversational Agent with Rig RS

Source: https://docs.rig.rs/docs/concepts/agent

This snippet demonstrates how to create a basic conversational agent using the `openai.agent` builder. It sets a preamble and temperature, then uses the agent to chat with a user, handling previous messages.

```rust
let chat_agent = openai.agent("gpt-4")
    .preamble("You are a conversational assistant.")
    .temperature(0.9)
    .build();
 
let response = chat_agent
    .chat("Hello!", previous_messages)
    .await?;
```

--------------------------------

### Build RAG Agent with Dynamic Context (Rust)

Source: https://docs.rig.rs/guides/rag/rag_system

Constructs a Retrieval-Augmented Generation (RAG) agent using the 'rig' crate. It creates an index from a vector store and configures the agent with a preamble and dynamic context to retrieve relevant documents for queries. Requires an initialized vector store and embedding model.

```rust
use rig::client::CompletionsClient;
 
// Create an index from the vector store
let index = vector_store.index(embedding_model);
 
// Create RAG agent using the new API
let rag_agent = openai_client
    .agent("gpt-3.5-turbo")
    .preamble("You are a helpful assistant that answers questions based on the given context from PDF documents.")
    .dynamic_context(2, index)
    .build();
```

--------------------------------

### Create Discord Bot Commands (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This snippet demonstrates how to define and create global commands for a Discord bot using the serenity library in Rust. It includes setting command names, descriptions, and types, and requires the 'serenity' and 'tokio' crates.

```rust
    let commands = vec![CreateCommandOption::default()
        .name("query")
        .description("Your question for the bot")
        .kind(CommandOptionType::String)
        .required(true)
        .into_command_option()];

    let builder = CreateApplicationCommands::default()
        .create_global_application_command(move || {
            ApplicationCommand::create_global_command("search", "Perform a RAGFlight search", commands)
        })
        .await;

    println!("Created the following global commands: {:#?}", builder);
```

--------------------------------

### Create Tools with tool_macro Derive Macro (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Demonstrates how to use the `tool_macro` derive macro from the `rig_derive` crate to easily create tools without writing a full `impl Tool` block. This macro simplifies tool creation by handling boilerplate code. It requires specifying a description and any required parameters.

```rust
use rig_derive::tool_macro;

// note that OpenAI Responses API, the currently default OpenAI integration for `rig`, requires all inputs to be required
#[rig_tool(
    description = "Perform basic arithmetic operations",
    required(x, y, operation)
)]
fn calculator(x: i32, y: i32, operation: String) -> Result<i32, rig::tool::ToolError> {
    match operation.as_str() {
        "add" => Ok(x + y),
        "subtract" => Ok(x - y),
        "multiply" => Ok(x * y),
        "divide" => {
            if y == 0 {
                Err(rig::tool::ToolError::ToolCallError(
                    "Division by zero".into(),
                ))
            } else {
                Ok(x / y)
            }
        }
        _ => Err(rig::tool::ToolError::ToolCallError(
            format!("Unknown operation: {operation}").into(),
        )),
    }
}
```

--------------------------------

### Generate Embeddings with Rig RS and OpenAI

Source: https://docs.rig.rs/docs/quickstart/embeddings

Demonstrates how to create an OpenAI client, select an embedding model, and build embeddings for documents using Rig RS. Requires the `OPENAI_API_KEY` environment variable to be set.

```rust
use rig::{embeddings::EmbeddingsBuilder, providers::openai};
use rig::client::{EmbeddingsClient, ProviderClient};

// Create OpenAI client and model
// This requires the `OPENAI_API_KEY` environment variable to be set.
let openai_client = openai::Client::from_env();

// Create embedding model
let model = openai_client.embedding_model("text-embedding-ada-002");

// Build embeddings
let embeddings = EmbeddingsBuilder::new(model)
    .document("Some text")? 
    .document("More text")? 
    .build()
    .await?;
```

--------------------------------

### Create CLI Chatbot from Agent - Rust

Source: https://docs.rig.rs/docs/extensions/cli_chatbot

Demonstrates how to create an interactive REPL-style chatbot using the `cli_chatbot` function. This function takes an agent that implements the `Chat` trait and manages the chat history, I/O, and basic command handling. It requires the `rig` crate and potentially specific provider implementations like `openai`.

```rust
use rig::{cli_chatbot, providers::openai};

let agent = openai.agent("gpt-4")
    .preamble("You are a helpful assistant.")
    .build();

cli_chatbot(agent).await?;
```

--------------------------------

### Integrate Custom Tool with Rig Agent (Rust)

Source: https://docs.rig.rs/docs/quickstart/tools

This Rust code demonstrates how to create an agent using the `rig` library and integrate the custom 'Adder' tool. The agent is configured with a specific model (GPT_4O), a preamble instructing it to act as a calculator, and the 'Adder' tool is added to its capabilities. This allows the agent to use the 'add' function during its operations.

```rust
use rig_core::providers;

// Assuming openai_client and Adder are defined and imported
// let openai_client = ...;
// struct Adder; // from previous snippet

// Create agent with a single context prompt and add a tool
let calculator_agent = openai_client
    .agent(providers::openai::GPT_4O)
    .preamble("You are a calculator here to help the user perform arithmetic operations. Use the tools provided to answer the user's question.")
    .max_tokens(1024)
    .tool(Adder)
    .build();

```

--------------------------------

### Rust Project Dependencies in Cargo.toml

Source: https://docs.rig.rs/guides/rag/rag_system

Defines the necessary dependencies for the RAG system in the `Cargo.toml` file. Includes Rig core, Tokio for async operations, anyhow for error handling, and pdf-extract for PDF processing.

```toml
[package]
name = "rag_system"
version = "0.1.0"
edition = "2024"

[dependencies]
rig-core = "0.24.0"
tokio = { version = "1.34.0", features = ["full"] }
anyhow = "1.0.75"
pdf-extract = "0.7.3"
```

--------------------------------

### Integrate Tools with Agents in Rig RS

Source: https://docs.rig.rs/docs/concepts/agent

This code illustrates how to build an agent capable of using tools. It demonstrates adding static tools like a calculator and web search, as well as dynamic tools from a tool store and toolset, configuring the agent with a preamble and temperature.

```rust
let tool_agent = openai.agent("gpt-4")
    .preamble("You are a tool-using assistant.")
    .tool(calculator) // calculator tool
    .tool(web_search) // web search tool - for example, Bing API
    .dynamic_tools(2, tool_store, toolset)
    .temperature(0.5)
    .build();
```

--------------------------------

### Embeddings and Vector Store with OpenAI in Rust

Source: https://docs.rig.rs/docs/why_rig

Demonstrates creating embeddings using OpenAI, storing them in an in-memory vector store, and performing a semantic search. It utilizes the `rig` crate for these operations. Dependencies include `rig` and `tokio`.

```rust
use rig::providers::openai;
use rig::embeddings::EmbeddingsBuilder;
use rig::vector_store::{in_memory_store::InMemoryVectorStore, VectorStore};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize OpenAI client and create an embedding model
    let openai_client = openai::Client::from_env();
    let embedding_model = openai_client.embedding_model("text-embedding-ada-002");

    // Create an in-memory vector store
    let mut vector_store = InMemoryVectorStore::default();

    // Generate embeddings for two documents
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .simple_document("doc1", "Rust is a systems programming language.")
        .simple_document("doc2", "Python is known for its simplicity.")
        .build()
        .await?;

    // Add the embeddings to the vector store
    vector_store.add_documents(embeddings).await?;

    // Create an index from the vector store
    let index = vector_store.index(embedding_model);
    // Query the index for the most relevant document to "What is Rust?"
    let results = index.top_n_from_query("What is Rust?", 1).await?;

    // Print the most relevant document
    println!("Most relevant document: {:?}", results[0].1.document);

    Ok(())
}
```

--------------------------------

### Perform Batch Processing in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Illustrates how to perform batch processing on a collection of documents using a pipeline. The `batch_call` method is used to process a specified number of items concurrently, improving efficiency for large datasets.

```rust
let pipeline = pipeline::new()
    .map(|text| analyze_sentiment(text));

// Process 5 documents concurrently
let results = pipeline.batch_call(5, documents).await;
```

--------------------------------

### Rust In-Memory Vector Store Initialization

Source: https://docs.rig.rs/guides/rag/rag_system

Initializes an in-memory vector store using Rig's `InMemoryVectorStore`. This store is suitable for small to medium document collections and holds data in RAM.

```rust
use rig::vector_store::in_memory_store::InMemoryVectorStore;
```

--------------------------------

### Add Documents with Function-Generated IDs (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

Illustrates initializing an InMemoryVectorStore where document IDs are generated dynamically using a provided closure. This is useful for creating IDs based on document content or metadata.

```rust
let store = InMemoryVectorStore::from_documents_with_id_f(
    documents,
    |doc| format!("doc_{}", doc.title)
);
```

--------------------------------

### Deploy Lambda Functions for S3 Storage (Shell)

Source: https://docs.rig.rs/guides/deploy/Blog_2_aws_lambda_lancedb

Builds and deploys Rust Lambda functions for interacting with an S3-backed LanceDB store. This involves compiling the Rust code using `cargo lambda` and then deploying the resulting binaries as Lambda functions, ensuring necessary IAM permissions are configured.

```bash
# Lambda that writes to the store
cargo lambda build --release --bin loader
cargo lambda deploy --binary-name loader <your_loader_function_name>

# Lambda that reads to the store
cargo lambda build --release --bin app
cargo lambda deploy --binary-name app <your_app_function_name>
```

--------------------------------

### Create RAG-Enabled Agent

Source: https://docs.rig.rs/docs/concepts/agent

Illustrates how to create a Retrieval-Augmented Generation (RAG) enabled agent. This involves setting up an in-memory vector store, indexing documents, and configuring the agent to dynamically fetch context.

```rust
use rig::{Agent, vector_store::InMemoryVectorStore};

// Create vector store and index
let store = InMemoryVectorStore::new();
let index = store.index(embedding_model);

// Create RAG agent
let agent = openai.agent("gpt-4")
    .preamble("You are a knowledge assistant.")
    .dynamic_context(3, index)  // Retrieve 3 relevant documents
    .build();
```

--------------------------------

### Auto-implementing Conversion Traits with a Macro in Rust

Source: https://docs.rig.rs/docs/concepts/provider_clients

Demonstrates the use of the `impl_conversion_traits` macro in Rust to auto-implement specific conversion traits for a client. This is useful when a provider does not support certain functionalities, by returning `None`.

```rust
// note: when adding a model to the rig-core codebase, `rig` should be `crate`
rig::impl_conversion_traits(
    AsEmbeddings,
    AsTranscription,
    AsImageGeneration,
    AsAudioGeneration for Client
);
```

--------------------------------

### Handle Slash Commands with Rig Agent in Rust Discord Bot

Source: https://docs.rig.rs/guides/advanced/discord_bot

Details the implementation of the `interaction_create` event handler for processing slash commands. It specifically handles 'hello' and 'ask' commands, routing queries to the `RigAgent` for processing and managing responses or errors.

```rust
async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
    debug!("Received an interaction");
    if let Interaction::ApplicationCommand(command) = interaction {
        debug!("Received command: {}", command.data.name);
        let content = match command.data.name.as_str() {
            "hello" => "Hello! I'm your helpful Rust and Rig-powered assistant. How can I assist you today?".to_string(),
            "ask" => {
                let query = command
                    .data
                    .options
                    .get(0)
                    .and_then(|opt| opt.value.as_ref())
                    .and_then(|v| v.as_str())
                    .unwrap_or("What would you like to ask?");
                debug!("Query: {}", query);
                match self.rig_agent.process_message(query).await {
                    Ok(response) => response,
                    Err(e) => {
                        error!("Error processing request: {:?}", e);
                        format!("Error processing request: {:?}", e)
                    }
                }
            }
            _ => "Not implemented :(".to_string(),
        };
 
        debug!("Sending response: {}", content);
 
        if let Err(why) = command
            .create_interaction_response(&ctx.http, |response| {
                response
                    .kind(InteractionResponseType::ChannelMessageWithSource)
                    .interaction_response_data(|message| message.content(content))
            })
            .await
        {
            error!("Cannot respond to slash command: {}", why);
        } else {
            debug!("Response sent successfully");
        }
    }
}
```

--------------------------------

### Error Handling with `anyhow` Context (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

Demonstrates how to add context to errors using the `anyhow` crate in Rust. The `with_context` method enhances error messages by including specific details, such as the file path that caused the read error.

```rust
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

// Example in rig_agent.rs
fn load_md_content<P: AsRef<Path>>(file_path: P) -> Result<String> {
    fs::read_to_string(file_path.as_ref())
        .with_context(|| format!("Failed to read markdown file: {:?}", file_path.as_ref()))
}
```

--------------------------------

### Define MCP Server with Tools (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Defines a custom MCP server named `CalculatorServer` using the `#[server]` macro. It exposes two tools: `add` and `multiply`, each with a description and defined parameters and return types.

```rust
use rmcp::prelude::*;

#[derive(Server)]
#[server(
    name = "my-calculator-server",
    version = "1.0.0"
)]
struct CalculatorServer;

#[server_impl]
impl CalculatorServer {
    #[tool(description = "Add two numbers together")]
    async fn add(&self, a: f64, b: f64) -> Result<f64> {
        Ok(a + b)
    }

    #[tool(description = "Multiply two numbers")]
    async fn multiply(&self, a: f64, b: f64) -> Result<f64> {
        Ok(a * b)
    }
}
```

--------------------------------

### Import Modules for Rig Agent in rig_agent.rs

Source: https://docs.rig.rs/guides/advanced/discord_bot

Imports necessary modules for the Rig agent implementation in Rust. This includes components for error handling, OpenAI providers, in-memory vector stores, embedding generation, the RAG agent, file system operations, and thread-safe data sharing using `Arc`.

```rust
// rig_agent.rs

use anyhow::{Context, Result};
use rig::providers::openai;
use rig::vector_store::in_memory_store::InMemoryVectorStore;
use rig::embeddings::EmbeddingsBuilder;
use rig::rag::RagAgent;
use std::path::Path;
use std::fs;
use std::sync::Arc;

```

--------------------------------

### Configure Advanced Completion Request (Rust)

Source: https://docs.rig.rs/docs/concepts/completion

Illustrates how to configure an advanced completion request with various options. This includes setting a preamble, temperature, documents, and tools.

```rust
let request = model
    .completion_request("Complex query")
    .preamble("Expert system")
    .temperature(0.8)
    .documents(context)
    .tools(available_tools)
    .send()
    .await?;
```

--------------------------------

### Run RAG System Command

Source: https://docs.rig.rs/guides/rag/rag_system

This command is used to execute the compiled Rust RAG system. Ensure that the required PDF files are placed in a 'documents' subfolder within your project's root directory before running.

```bash
cargo run
```

--------------------------------

### Handle Multiple LLM Requests Concurrently with Rig and Tokio

Source: https://docs.rig.rs/docs/why_rig

This Rust code snippet demonstrates how to handle multiple LLM requests concurrently using the Rig library and the Tokio runtime. It spawns 10 asynchronous tasks, each making a request to an OpenAI model, and then collects their results. This showcases Rig's efficient resource sharing and memory safety features for concurrent applications.

```rust
use rig::providers::openai;
use rig::completion::Prompt;
use tokio::task;
use std::time::Instant;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let openai_client = openai::Client::from_env();
    let model = Arc::new(openai_client.model("gpt-3.5-turbo").build());

    let start = Instant::now();
    let mut handles = vec![];

    // Spawn 10 concurrent tasks
    for i in 0..10 {
        let model_clone = Arc::clone(&model);
        let handle = task::spawn(async move {
            let prompt = format!("Generate a random fact about the number {}", i);
            model_clone.prompt(&prompt).await
        });
        handles.push(handle);
    }

    // Collect results
    for handle in handles {
        let result = handle.await??;
        println!("Result: {}", result);
    }

    println!("Time elapsed: {:?}", start.elapsed());
    Ok(())
}
```

--------------------------------

### Basic Extractor Usage in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Demonstrates the basic usage of the Rig Extractor in Rust. It shows how to define a target data structure (`Person`), create an OpenAI client, build an extractor for the `Person` structure, and then use it to extract data from a given text string.

```rust
use rig::providers::openai;

// Define target structure
#[derive(serde::Deserialize, serde::Serialize, schemars::JsonSchema)]
struct Person {
    name: Option<String>,
    age: Option<u8>,
    profession: Option<String>,
}

// Create and use extractor
let openai = openai::Client::new(api_key);
let extractor = openai.extractor::<Person>(openai::GPT_4O).build();

let person = extractor.extract("John Doe is a 30 year old doctor.").await?;
```

--------------------------------

### Implementing Named Entity Recognition with Rig RS in Rust

Source: https://docs.rig.rs/guides/text_extraction_classification

This code implements a named entity recognition (NER) system using Rig RS. It sets up an OpenAI client, configures an extractor for ExtractedEntities with a specific preamble for NER, and then processes a sample text to identify people, organizations, and locations with their indices.

```rust
#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();
    let openai_client = openai::Client::from_env()?;
 
    let ner_extractor = openai_client
        .extractor::<ExtractedEntities>("gpt-3.5-turbo")
        .preamble("\n            You are a named entity recognition AI. Identify and extract people, organizations, and locations from the given text.\n            Provide the start and end indices for each entity.\n        ")
        .build();
 
    let text = "Apple Inc., based in Cupertino, was founded by Steve Jobs and Steve Wozniak.";
    let result = ner_extractor.extract(text).await?;
 
    println!("Text: {}", text);
    for entity in result.entities {
        println!(
            "Entity: {:?}, Type: {:?}, Range: {}:{}",
            entity.text,
            entity.entity_type,
            entity.start,
            entity.end
        );
    }
 
    Ok(())
}
```

--------------------------------

### Add Project Dependencies in Cargo.toml

Source: https://docs.rig.rs/guides/advanced/discord_bot

Specifies the dependencies required for the Rig RS project, including core libraries for AI integration, Discord API interaction, asynchronous operations, and utility crates for error handling, logging, and serialization. These are added to the `Cargo.toml` file under the `[dependencies]` section.

```toml
[dependencies]
rig-core = "0.2.1" # [Rig Crate](https://crates.io/crates/rig-core)
tokio = { version = "1.34.0", features = ["full"] }
serenity = { version = "0.11", default-features = false, features = ["client", "gateway", "rustls_backend", "cache", "model", "http"] }
dotenv = "0.15.0"
anyhow = "1.0.75"
tracing = "0.1"
tracing-subscriber = "0.3"
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
schemars = "0.8"
async-trait = "0.1.83"

```

--------------------------------

### Use MCP Tools with Rig Agent (Rust)

Source: https://docs.rig.rs/docs/integrations/model_context_protocol

Integrates a list of MCP tools with a Rig agent. The agent is built using a completion model and configured with the retrieved tools and client peer information, then used to prompt for a calculation.

```rust
let completion_model = providers::openai::Client::from_env();

let agent = completion_model
    .agent("gpt-4o")
    .rmcp_tools(tools, client.peer().to_owned())
    .build();

let response = agent.prompt("Add 10 + 10").await?;
tracing::info!("Agent response: {:?}", response);
```

--------------------------------

### Add rig-neo4j Crate Dependency

Source: https://docs.rig.rs/docs/integrations/vector_stores/neo4j

This snippet shows how to add the rig-neo4j crate as a dependency to your Rust project's Cargo.toml file. This is the first step to using the Neo4j vector store integration.

```toml
[dependencies]
rig-neo4j = "0.2.0"

```

--------------------------------

### Basic Extraction Pattern in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Illustrates a common pattern for basic data extraction using the Rig Extractor. It shows the initialization of an extractor for a `SimpleType` and its subsequent use to extract data from a raw text string.

```rust
let extractor = client.extractor::<SimpleType>(model).build();
let data = extractor.extract("raw text").await?;
```

--------------------------------

### Define Simple and Async Operations in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Demonstrates how to create basic and asynchronous operations using the rig::pipeline API. The `map` combinator is used for synchronous transformations, while `then` is used for asynchronous ones. These operations are the building blocks for more complex pipelines.

```rust
use rig::pipeline::{self, Op};

// Simple operation that adds two numbers
let add_op = pipeline::new()
    .map(|(x, y)| x + y);

// Operation with async processing
let async_op = pipeline::new()
    .then(|x| async move { x * 2 });
```

--------------------------------

### Available Vector Store Companion Crates

Source: https://docs.rig.rs/docs/integrations

Lists the available companion crates for integrating various vector stores with Rig. These are separate crates that implement the `VectorStoreIndex` trait from `rig-core`.

```text
Vector stores are available as separate companion-crates:

- MongoDB vector store: [`rig-mongodb`](https://github.com/0xPlaygrounds/rig/tree/main/rig-mongodb)
- LanceDB vector store: [`rig-lancedb`](https://github.com/0xPlaygrounds/rig/tree/main/rig-lancedb)
- Neo4j vector store: [`rig-neo4j`](https://github.com/0xPlaygrounds/rig/tree/main/rig-neo4j)
- Qdrant vector store: [`rig-qdrant`](https://github.com/0xPlaygrounds/rig/tree/main/rig-qdrant)
- SurrealDB vector store: [`rig-surrealdb`](https://github.com/0xPlaygrounds/rig/tree/main/rig-surrealdb)
```

--------------------------------

### Completion API - Provider Integration

Source: https://docs.rig.rs/docs/concepts/completion

Provides guidance on how to implement new providers for the Completion API.

```APIDOC
## Provider Integration

### Implementing New Providers
To integrate a new AI provider, implement the `CompletionModel` trait.

```rust
// Assuming 'CustomProvider' is your provider struct and 'CustomResponse' is its response type
// impl CompletionModel for CustomProvider {
//     type Response = CustomResponse;
// 
//     async fn completion(
//         &self,
//         request: CompletionRequest
//     ) -> Result<CompletionResponse<Self::Response>, CompletionError> {
//         // Provider-specific implementation details go here
//     }
// }
```
```

--------------------------------

### Implement call Function for Flight Search in Rust

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This code implements the `call` function, which retrieves an API key, sets default values for the date, builds query parameters, makes an API request using `reqwest`, and parses the response. It handles error cases and formats the output for the user.

```Rust
let api_key = env::var("RAPIDAPI_KEY").map_err(|_| FlightSearchError::MissingApiKey)?;

let date = args.date.unwrap_or_else(|| {
    let date = Utc::now() + Duration::days(30);
    date.format("%Y-%m-%d").to_string()
});

let mut query_params = HashMap::new();
query_params.insert("sourceAirportCode", args.source);
query_params.insert("destinationAirportCode", args.destination);
query_params.insert("date", date);

let client = reqwest::Client::new();
let response = client
    .get("https://tripadvisor16.p.rapidapi.com/api/v1/flights/searchFlights")
    .headers({
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("X-RapidAPI-Host", "tripadvisor16.p.rapidapi.com".parse().unwrap());
        headers.insert("X-RapidAPI-Key", api_key.parse().unwrap());
        headers
    })
    .query(&query_params)
    .send()
    .await
    .map_err(|e| FlightSearchError::HttpRequestFailed(e.to_string()))?;

let text = response
    .text()
    .await
    .map_err(|e| FlightSearchError::HttpRequestFailed(e.to_string()))?;

let data: Value = serde_json::from_str(&text)
    .map_err(|e| FlightSearchError::HttpRequestFailed(e.to_string()))?;

let mut flight_options = Vec::new();

// Here, we need to extract the flight options. (It's quite detailed, so we've omitted the full code to keep the focus clear.)

// Format the flight options into a readable string
let mut output = String::new();
output.push_str("Here are some flight options:\n\n");

for (i, option) in flight_options.iter().enumerate() {
    output.push_str(&format!("{}. **Airline**: {}\n", i + 1, option.airline));
    // Additional formatting...
}

Ok(output)
```

--------------------------------

### Concurrent LLM Query Execution in Rust

Source: https://docs.rig.rs/examples/advanced/concurrent_processing

Implements concurrent execution of LLM queries using Rig and Tokio. It initializes an OpenAI client, creates a shared model instance, spawns multiple asynchronous tasks for queries, and collects the results.

```rust
use rig_core::prelude::*;
use rig_core::client::openai::OpenAIClient;
use rig_core::model::openai::OpenAIModel;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()>{ 
    let api_key = std::env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY must be set");
    let client = OpenAIClient::new(api_key);

    let model = Arc::new(OpenAIModel::new("gpt-3.5-turbo".to_string(), client));

    let mut tasks = vec![];

    for i in 0..5 {
        let model_clone = Arc::clone(&model);
        let task = tokio::spawn(async move {
            let prompt = format!("Hello from task {}!", i);
            match model_clone.generate(
                prompt,
                Some(rig_core::model::GenerationConfig {
                    max_tokens: Some(50),
                    ..Default::default()
                })
            ).await {
                Ok(response) => response,
                Err(e) => format!("Error in task {}: {}", i, e),
            }
        });
        tasks.push(task);
    }

    for task in tasks {
        let result = task.await.unwrap();
        println!("Task result: {}", result);
    }

    Ok(())
}
```

--------------------------------

### Load Rust Files with FileLoader

Source: https://docs.rig.rs/docs/concepts/loaders

Demonstrates loading all Rust files within a specified directory using FileLoader and glob pattern matching. It includes options for reading content with path information and ignoring errors during the process.

```rust
use rig::loaders::FileLoader;
 
// Load all Rust files in examples directory
let examples = FileLoader::with_glob("examples/*.rs")?
    .read_with_path()
    .ignore_errors()
    .into_iter();
```

```rust
    // Load in all the rust examples
    let examples = FileLoader::with_glob("rig-core/examples/*.rs")?
        .read_with_path()
        .ignore_errors()
        .into_iter();
 
    // Create an agent with multiple context documents
    let agent = examples
        .fold(AgentBuilder::new(model), |builder, (path, content)| {
            builder.context(format!("Rust Example {:?}:\n{}", path, content).as_str())
        })
        .build();
```

--------------------------------

### Add Rig Core and Tokio Dependency to Rust Project

Source: https://docs.rig.rs/docs/quickstart/getting_started

This command adds the `rig-core` and `tokio` dependencies to your Rust project's Cargo.toml file. `rig-core` is the main library for Rig, and Tokio is an asynchronous Rust runtime required for `rig`'s operations.

```bash
cargo add rig-core tokio
```

--------------------------------

### Flexible File Loading Patterns with FileLoader

Source: https://docs.rig.rs/docs/concepts/loaders

Shows various methods for specifying input sources with FileLoader, including glob patterns, directory paths, and byte vectors. This allows for flexible data ingestion from different origins.

```rust
// Using glob patterns
let glob_loader = FileLoader::with_glob("**/*.txt")?;
 
// Using directory
let dir_loader = FileLoader::with_dir("data/")?;
 
// Using a Vec<u8> - this can be from any source: for example, a file download from the Internet
let bytes: Vec<u8> = vec![1, 2, 3, 4];
let u8_loader = FileLoader::from_bytes(bytes);
```

--------------------------------

### Add rig-qdrant Dependency to Cargo.toml

Source: https://docs.rig.rs/docs/integrations/vector_stores/qdrant

This snippet shows how to add the rig-qdrant crate as a dependency in your project's Cargo.toml file. Ensure you are using a compatible version.

```toml
[dependencies]
rig-qdrant = "0.1.5"

```

--------------------------------

### Directory Processing with FileLoader

Source: https://docs.rig.rs/docs/concepts/loaders

Shows how to use FileLoader to traverse a directory and read files, including their paths. The `read_with_path()` method retrieves both the file path and its content, with `ignore_errors()` ensuring robust processing.

```rust
let dir_loader = FileLoader::with_dir("data/")?
    .read_with_path()
    .ignore_errors();
 
for (path, content) in dir_loader {
    // Process files with path context
}
```

--------------------------------

### Add rig-surrealdb to Cargo.toml

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

This snippet shows how to add the `rig-surrealdb` crate as a dependency in your project's `Cargo.toml` file. Ensure you are using a compatible version.

```toml
[dependencies]
rig-surrealdb = "0.1.0"

```

--------------------------------

### JSON Schema Generation with schemars (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Demonstrates using the `schemars` crate's derive macro to automatically generate JSON schemas for tool arguments in Rust. This simplifies schema definition by using attributes for descriptions.

```rust
#[derive(Deserialize, Serialize, schemars::JsonSchema)]
struct OperationArgs {
    #[schemars(description = "The first number to add.")]
    x: i32,
    #[schemars(description = "The first number to add.")]
    y: i32,
}
```

--------------------------------

### Rust Discord Bot Core Logic (Serenity, Rig Agent)

Source: https://docs.rig.rs/guides/advanced/discord_bot

The main Rust code for a Discord bot. It sets up event handling for interactions (slash commands) and messages. It uses the Rig Agent to process user queries and responds accordingly. Dependencies include Serenity, anyhow, tracing, and dotenv.

```rust
// main.rs

mod rig_agent;

use anyhow::Result;
use serenity::async_trait;
use serenity::model::application::command::Command;
use serenity::model::application::interaction::{Interaction, InteractionResponseType};
use serenity::model::gateway::Ready;
use serenity::model::channel::Message;
use serenity::prelude::*;
use serenity::model::application::command::CommandOptionType;
use std::env;
use std::sync::Arc;
use tracing::{error, info, debug};
use rig_agent::RigAgent;
use dotenv::dotenv;

// Define a key for storing the bot's user ID in the TypeMap
struct BotUserId;

impl TypeMapKey for BotUserId {
    type Value = serenity::model::id::UserId;
}

struct Handler {
    rig_agent: Arc<RigAgent>,
}

#[async_trait]
impl EventHandler for Handler {
    async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
        debug!("Received an interaction");
        if let Interaction::ApplicationCommand(command) = interaction {
            debug!("Received command: {}", command.data.name);
            let content = match command.data.name.as_str() {
                "hello" => "Hello! I'm your helpful Rust and Rig-powered assistant. How can I assist you today?".to_string(),
                "ask" => {
                    let query = command
                        .data
                        .options
                        .get(0)
                        .and_then(|opt| opt.value.as_ref())
                        .and_then(|v| v.as_str())
                        .unwrap_or("What would you like to ask?");
                    debug!("Query: {}", query);
                    match self.rig_agent.process_message(query).await {
                        Ok(response) => response,
                        Err(e) => {
                            error!("Error processing request: {:?}", e);
                            format!("Error processing request: {:?}", e)
                        }
                    }
                }
                _ => "Not implemented :(".to_string(),
            };

            debug!("Sending response: {}", content);

            if let Err(why) = command
                .create_interaction_response(&ctx.http, |response| {
                    response
                        .kind(InteractionResponseType::ChannelMessageWithSource)
                        .interaction_response_data(|message| message.content(content))
                })
                .await
            {
                error!("Cannot respond to slash command: {}", why);
            } else {
                debug!("Response sent successfully");
            }
        }
    }

    async fn message(&self, ctx: Context, msg: Message) {
        if msg.mentions_me(&ctx.http).await.unwrap_or(false) {
            debug!("Bot mentioned in message: {}", msg.content);

            let bot_id = {
                let data = ctx.data.read().await;
                data.get::<BotUserId>().copied()
            };

            if let Some(bot_id) = bot_id {
                let mention = format!("<@{}>", bot_id);
                let content = msg.content.replace(&mention, "").trim().to_string();

                debug!("Processed content after removing mention: {}", content);

                match self.rig_agent.process_message(&content).await {
                    Ok(response) => {
                        if let Err(why) = msg.channel_id.say(&ctx.http, response).await {
                            error!("Error sending message: {:?}", why);
                        }
                    }
                    Err(e) => {
                        error!("Error processing message: {:?}", e);
                        if let Err(why) = msg
                            .channel_id
                            .say(&ctx.http, format!("Error processing message: {:?}", e))
                            .await
                        {
                            error!("Error sending error message: {:?}", why);
                        }
                    }
                }
            } else {
                error!("Bot user ID not found in TypeMap");
            }
        }
    }

    async fn ready(&self, ctx: Context, ready: Ready) {
        info!("{} is connected!", ready.user.name);

        {
            let mut data = ctx.data.write().await;
            data.insert::<BotUserId>(ready.user.id);
        }

        let commands = Command::set_global_application_commands(&ctx.http, |commands| {
            commands
                .create_application_command(|command| {
                    command
                        .name("hello")
                        .description("Say hello to the bot")
                })
                .create_application_command(|command| {
                    command
                        .name("ask")
                        .description("Ask the bot a question")
                        .create_option(|option| {
                            option
                        })
        });
    }
}

```

--------------------------------

### Basic Tool Implementation: Adder (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Implements a basic 'add' tool in Rust using the `Tool` trait. It defines input arguments (`AddArgs`), output type, error handling, and the execution logic for adding two integers. This tool is not RAG-enabled.

```rust
#[derive(Deserialize)]
struct AddArgs {
    x: i32,
    y: i32,
}
 
#[derive(Deserialize, Serialize)]
struct Adder;
 
impl Tool for Adder {
    const NAME: &'static str = "add";
    type Error = MathError;
    type Args = AddArgs;
    type Output = i32;
 
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "add".to_string(),
            description: "Add x and y together".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "First number" },
                    "y": { "type": "number", "description": "Second number" }
                }
            })
        }
    }
 
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        Ok(args.x + args.y)
    }
}
```

--------------------------------

### Perform Contextual Chat (Rust)

Source: https://docs.rig.rs/docs/concepts/completion

Shows how to perform a chat completion by providing conversational history. This is useful for maintaining context in multi-turn dialogues.

```rust
let chat_response = model
    .chat(
        "Continue the discussion",
        vec![Message::user("Previous context")]
    )
    .await?;
```

--------------------------------

### Define Flight Search Arguments and Results Structures

Source: https://docs.rig.rs/guides/advanced/flight_assistant

These Rust structs define the data structures for the flight search tool. `FlightSearchArgs` represents the input parameters from the user, while `FlightOption` represents the structure for each flight result returned.

```rust
#[derive(Deserialize)]
pub struct FlightSearchArgs {
    source: String,
    destination: String,
    date: Option<String>,
    sort: Option<String>,
    service: Option<String>,
    itinerary_type: Option<String>,
    adults: Option<u8>,
    seniors: Option<u8>,
    currency: Option<String>,
    nearby: Option<String>,
    nonstop: Option<String>,
}

#[derive(Serialize)]
pub struct FlightOption {
    pub airline: String,
    pub flight_number: String,
    pub departure: String,
    pub arrival: String,
    pub duration: String,
    pub stops: usize,
    pub price: f64,
    pub currency: String,
    pub booking_url: String,
}
```

--------------------------------

### Add Additional Parameters to Agent

Source: https://docs.rig.rs/docs/concepts/agent

Demonstrates how to pass provider-specific additional parameters to an agent during its creation. This is useful for configuring advanced model behaviors not covered by standard options.

```rust
// replace `create_openai_client() with whatever way you're using
// to instantiate your model provider client
let openai_client = create_openai_client();

let agent = openai_client.agent("gpt-5")
    .preamble("You are a helpful agent")
    .additional_params(serde_json::json!({
        "foo": "bar"
    }))
    .build();
```

--------------------------------

### Define Custom LLM Provider Client and Builder in Rust

Source: https://docs.rig.rs/guides/extension/write_your_own_provider

This Rust code defines a `MyProviderClient` struct to represent a custom LLM provider's client, including fields for API key, HTTP client, and base URL. It implements a `new` function and a builder pattern (`MyProviderClientBuilder`) for flexible client instantiation, handling default values and optional configurations.

```rust
const BASE_URL: &str = "https://example.com";
 
#[derive(Clone)]
pub struct MyProviderClient {
    api_key: String,
    http_client: reqwest::Client,
    base_url: String
    // Add any other provider-specific fields here
}
 
impl MyProviderClient {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self::builder().api_key(api_key.into()).build()
    }
 
    pub fn builder() -> MyProviderClientBuilder {
        MyProviderClientBuilder::default()
    }
}
 
#[derive(Default)]
struct MyProviderClientBuilder {
  api_key: Option<String>,
  http_client: Option<reqwest::Client>,
  base_url: Option<String>
}
 
impl MyProviderClientBuilder {
  fn api_key(mut self, api_key: String) -> Self {
    self.api_key = Some(api_key);
    self
  }
 
  fn custom_client(mut self, client: reqwest::Client) -> Self {
      self.http_client = Some(client);
      self
  }
 
  fn build(self) -> MyProviderClient {
    // in practical usage
    // you may wish to use real error handling here
    let api_key = self.api_key.unwrap();
    let http_client = self.http_client.unwrap_or_default();
    let base_url = self.base_url.unwrap_or(BASE_URL);
    MyProviderClient { api_key, http_client, base_url }
  }
}
```

--------------------------------

### Implement Custom Provider Interface (Rust)

Source: https://docs.rig.rs/docs/concepts/completion

Provides a template for implementing a new provider by adhering to the `CompletionModel` trait. This involves defining the response type and implementing the `completion` method.

```rust
impl CompletionModel for CustomProvider {
    type Response = CustomResponse;

    async fn completion(
        &self,
        request: CompletionRequest
    ) -> Result<CompletionResponse<Self::Response>, CompletionError> {
        // Provider-specific implementation
    }
}
```

--------------------------------

### Implement Secure Debug for Client Struct in Rust

Source: https://docs.rig.rs/guides/extension/write_your_own_provider

This Rust code manually implements the `std::fmt::Debug` trait for a `Client` struct. It ensures that sensitive information, specifically the `api_key`, is redacted with "<REDACTED>" when the client is printed for debugging purposes, enhancing security by preventing accidental logging of credentials.

```rust
impl std::fmt::Debug for Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Client")
            .field("base_url", &self.base_url)
            .field("http_client", &self.http_client)
            .field("api_key", &"<REDACTED>")
            .finish()
    }
}
```

--------------------------------

### Contextual Extraction Pattern in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Demonstrates a pattern for contextual data extraction, allowing for more refined results by providing a preamble and domain-specific context to the extractor. This is useful for complex extraction tasks requiring specific rules or background information.

```rust
let extractor = client.extractor::<ComplexType>(model)
    .preamble("Extract with following rules...")
    .context("Domain-specific information...")
    .build();
```

--------------------------------

### Vector Search Implementation in Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

Implements vector search on an InMemoryVectorStore, sorting documents by embedding distance to find the best context for a given prompt embedding. It iterates through stored embeddings, calculates cosine similarity, and uses a binary heap to maintain the top results.

```rust
/// Implement vector search on [InMemoryVectorStore].
    /// To be used by implementations of [VectorStoreIndex::top_n] and [VectorStoreIndex::top_n_ids] methods.
    fn vector_search(&self, prompt_embedding: &Embedding, n: usize) -> EmbeddingRanking<D> {
        // Sort documents by best embedding distance
        let mut docs = BinaryHeap::new();
 
        for (id, (doc, embeddings)) in self.embeddings.iter() {
            // Get the best context for the document given the prompt
            if let Some((distance, embed_doc)) = embeddings
                .iter()
                .map(|embedding| {
                    (
                        OrderedFloat(embedding.cosine_similarity(prompt_embedding, false)),
                        &embedding.document,
                    )
                })
                .max_by(|a, b| a.0.cmp(&b.0)) {
                docs.push(Reverse(RankingItem(distance, id, doc, embed_doc)));
            };

```

--------------------------------

### RAG-Enabled Tool Implementation: Add (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Implements a RAG-enabled 'add' tool in Rust by implementing both `Tool` and `ToolEmbedding` traits. This allows the tool to be stored in vector stores and retrieved semantically. It defines input arguments using `OperationArgs` and provides embedding documentation.

```rust
struct Add;
 
impl Tool for Add {
    const NAME: &'static str = "add";
 
    type Error = MathError;
    type Args = OperationArgs;
    type Output = i32;
 
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        serde_json::from_value(json!({
            "name": "add",
            "description": "Add x and y together",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {
                        "type": "number",
                        "description": "The first number to add"
                    },
                    "y": {
                        "type": "number",
                        "description": "The second number to add"
                    }
                }
            }
        }))
        .expect("Tool Definition")
    }
 
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let result = args.x + args.y;
        Ok(result)
    }
}
 
impl ToolEmbedding for Add {
    type InitError = InitError;
    type Context = ();
    type State = ();
 
    fn init(_state: Self::State, _context: Self::Context) -> Result<Self, Self::InitError> {
        Ok(Add)
    }
 
    fn embedding_docs(&self) -> Vec<String> {
        vec!["Add x and y together".into()]
    }
 
    fn context(&self) -> Self::Context {}
}
```

--------------------------------

### Completion API - Request Components

Source: https://docs.rig.rs/docs/concepts/completion

This section outlines the various components that can be included in a completion request, such as core elements, context management, and tool integration.

```APIDOC
## Completion API - Request Components

### Core Elements
- **Prompt text**: The main input for the model.
- **System preamble**: Instructions or context for the model's behavior.
- **Chat history**: Previous messages in a conversation.
- **Temperature**: Controls randomness of the output (0.0 to 1.0).
- **Max tokens**: Maximum number of tokens to generate.

### Context Management
- **Document attachments**: External documents to provide context.
- **Metadata handling**: Additional data associated with the request.
- **Formatting controls**: Specify output formatting.

### Tool Integration
- **Tool definitions**: Descriptions of available tools for the model to use.
- **Parameter validation**: Ensures tool parameters are correctly formatted.
- **Response parsing**: How to interpret tool responses.
```

--------------------------------

### Connect LanceDB to EFS Storage (Rust)

Source: https://docs.rig.rs/guides/deploy/Blog_2_aws_lambda_lancedb

Connects a LanceDB instance to an Amazon EFS (Elastic File System) volume mounted within an AWS Lambda function. This enables persistent and shared storage across multiple Lambda invocations, providing stateful capabilities.

```rust
let db = lancedb::connect("/mnt/efs").execute().await?;
```

--------------------------------

### Customize Extractor with Preamble and Context in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Shows how to customize the Rig Extractor by providing a preamble and additional context. This allows for more specific instructions to the LLM, improving extraction precision and handling of specific data formats.

```rust
let extractor = openai.extractor::<Person>(model)
    .preamble("Extract person details with high precision")
    .context("Additional context about person formats")
    .build();
```

--------------------------------

### Completion API - Response Handling

Source: https://docs.rig.rs/docs/concepts/completion

Details the structure of the `CompletionResponse` and the possible `CompletionError` types.

```APIDOC
## Response Handling

### CompletionResponse
A structured response type that can contain either a message or a tool call.

```rust
enum ModelChoice {
    Message(String),
    ToolCall(String, serde_json::Value)
}

struct CompletionResponse<T> {
    choice: ModelChoice,
    raw_response: T,
}
```

### Error Handling
Defines the various error types that can occur during API interactions.

```rust
enum CompletionError {
    HttpError(reqwest::Error),
    JsonError(serde_json::Error),
    RequestError(Box<dyn std::error::Error>),
    ResponseError(String),
    ProviderError(String),
}
```
```

--------------------------------

### Implement Sentiment Classifier with Rig and OpenAI

Source: https://docs.rig.rs/guides/text_extraction_classification

This Rust code snippet implements a sentiment analysis classifier using Rig and the OpenAI provider. It initializes an OpenAI client, configures an `Extractor` with a preamble for sentiment analysis, and then uses it to classify the sentiment of a given text, printing the result.

```rust
#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok(); // Load environment variables securely
    let openai_client = openai::Client::from_env();
 
    let sentiment_classifier = openai_client
        .extractor::<SentimentClassification>("gpt-3.5-turbo")
        .preamble("You are a sentiment analysis AI. Classify the sentiment of the given text.")
        .build();
 
    let text = "I absolutely loved the new restaurant. The food was amazing!";
    let result = sentiment_classifier.extract(text).await?;
 
    println!("Text: {}", text);
    println!("Sentiment: {:?}", result.sentiment);
    println!("Confidence: {:.2}", result.confidence);
 
    Ok(())
}
```

--------------------------------

### Process User Message with Rig Agent (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

The `process_message` function handles user input by passing it to the `RagAgent` for processing. It asynchronously calls the agent's `prompt` method, which retrieves relevant information from a knowledge base and generates a response. Errors during processing are converted to `anyhow::Error`.

```rust
pub async fn process_message(&self, message: &str) -> Result<String> {
    self.rag_agent.prompt(message).await.map_err(anyhow::Error::from)
}
```

--------------------------------

### Prompt Trait for One-Shot LLM Interactions

Source: https://docs.rig.rs/docs/concepts/completion

The `Prompt` trait provides the simplest interface for one-shot, fire-and-forget LLM interactions, returning string responses. It is a high-level interface for basic prompting.

```rust
async fn prompt(&self, prompt: &str) -> Result<String, PromptError>;
```

--------------------------------

### OpenAI API Response Structures (Rust)

Source: https://docs.rig.rs/docs/integrations/model_providers/openai

Defines the core data structures for handling responses from the OpenAI API, including choices, messages, tool calls, and tool definitions. These are used for parsing API results.

```rust
#[derive(Debug, Deserialize)]
pub struct Choice {
    pub index: usize,
    pub message: Message,
    pub logprobs: Option<serde_json::Value>,
    pub finish_reason: String,
}

#[derive(Debug, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub r#type: String,
    pub function: Function,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ToolDefinition {
    pub r#type: String,
    pub function: completion::ToolDefinition,
}

impl From<completion::ToolDefinition> for ToolDefinition {
    fn from(tool: completion::ToolDefinition) -> Self {
        Self {
            r#type: "function".into(),
            function: tool,
        }
    }
}
```

--------------------------------

### Load PDF Documents with PdfFileLoader

Source: https://docs.rig.rs/docs/concepts/loaders

Illustrates loading PDF documents using PdfFileLoader, supporting glob pattern matching for file selection. It includes options for page-by-page extraction and ignoring errors.

```rust
use rig::loaders::PdfFileLoader;
 
let documents = PdfFileLoader::with_glob("docs/*.pdf")?
    .load_with_path()
    .ignore_errors()
    .by_page()
    .into_iter();
```

```rust
    fn load(self) -> Result<Document, PdfLoaderError> {
        Document::load(self).map_err(PdfLoaderError::PdfError)
    }
    fn load_with_path(self) -> Result<(PathBuf, Document), PdfLoaderError> {
        let contents = Document::load(&self);
        Ok((self, contents?))
    }
}
impl<T: Loadable> Loadable for Result<T, PdfLoaderError> {
    fn load(self) -> Result<Document, PdfLoaderError> {
        self.map(|t| t.load())?
    }
    fn load_with_path(self) -> Result<(PathBuf, Document), PdfLoaderError> {
        self.map(|t| t.load_with_path())?
    }
```

```rust
let pdf_loader = PdfFileLoader::with_glob("docs/*.pdf")?;
let pages = pdf_loader
    .load_with_path()
    .ignore_errors()
    .by_page()
    .into_iter();
```

--------------------------------

### Connect LanceDB to S3 with DynamoDB Commit Store (Rust)

Source: https://docs.rig.rs/guides/deploy/Blog_2_aws_lambda_lancedb

Connects a LanceDB instance to an S3 bucket, utilizing a DynamoDB table to manage commits and prevent concurrent write issues. This is crucial for maintaining data integrity when multiple Lambda functions might access the same S3-backed LanceDB table.

```rust
// Note: Create s3://rig-montreal-lancedb bucket beforehand
let db = lancedb::connect("s3://rig-montreal-lancedb").execute().await?;
// OR
let db = lancedb::connect("s3+ddb://rig-montreal-lancedb?ddbTableName=my-dynamodb-table").execute().await?;
```

--------------------------------

### Implement TryOp for Fallible Operations in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Shows the implementation of the `TryOp` trait for operations that can potentially fail. The `try_batch_call` method is defined to handle a collection of inputs, returning a `Result` that contains either a vector of successful outputs or an error.

```rust
use rig::pipeline::{self, Op};
use stream::{StreamExt, TryStreamExt};

    fn try_batch_call<I>(
        &self,
        n: usize,
        input: I,
    ) -> impl Future<Output = Result<Vec<Self::Output>, Self::Error>> + Send
    where
        I: IntoIterator<Item = Self::Input> + Send,
        I::IntoIter: Send,
        Self: Sized,
    {
        async move {
            stream::iter(input)
            // ... more code here
        }
    }
```

--------------------------------

### Integrating schemars with Tool Definition (Rust)

Source: https://docs.rig.rs/docs/concepts/tools

Shows how to integrate automatically generated JSON schemas from `schemars` into a Rig tool's definition in Rust. It converts the schema into a `serde_json::Value` and uses it for the tool's parameters.

```rust
#[derive(Deserialize, Serialize)]
struct Adder;
 
impl Tool for Adder {
    // .. other trait impl parts here
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        // this should technically never error out as it's generated from set codegen
        let parameters = serde_json::to_value(schema_for!(OperationArgs)).unwrap();
 
        ToolDefinition {
            name: "add".to_string(),
            description: "Add x and y together".to_string(),
            parameters,
        }
    }
    // .. other trait impl parts here
}
```

--------------------------------

### Load Markdown Content Function (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

The `load_md_content` function reads the content of a Markdown file from a given file path. It accepts a generic parameter `P` that can be converted to a `Path`. The function returns the file content as a `String` or an error if reading fails, providing context about the failure.

```rust
fn load_md_content<P: AsRef<Path>>(file_path: P) -> Result<String> {
    fs::read_to_string(file_path.as_ref())
        .with_context(|| format!("Failed to read markdown file: {:?}", file_path.as_ref()))
}
```

--------------------------------

### Text Analysis with Combined Tasks in Rust

Source: https://docs.rig.rs/guides/text_extraction_classification

This snippet demonstrates how to perform both sentiment analysis and named entity recognition in a single operation using Rig RS. It configures an extractor for the `TextAnalysis` struct, providing a preamble that instructs the model to perform both tasks and output the results in the defined structure.

```rust
#[tokio::main]
async fn main() -> Result<()> {
    dotenv::dotenv().ok();
    let openai_client = openai::Client::from_env()?;
 
    let text_analyzer = openai_client
        .extractor::<TextAnalysis>("gpt-3.5-turbo")
        .preamble("\n            You are a text analysis AI. For the given text:\n            1. Classify the overall sentiment (Positive, Negative, or Neutral) with a confidence score.\n            2. Identify and extract named entities (Person, Organization, Location) with their start and end indices.\n        ")
        .build();
 
    let text = "I had a great time visiting Google's headquarters in Mountain View. Sundar Pichai's leadership has been impressive.";
    let result = text_analyzer.extract(text).await?;
 
    println!("Text: {}", text);
    println!("Sentiment: {:?} (Confidence: {:.2})", result.sentiment.sentiment, result.sentiment.confidence);
    println!("Entities:");
    for entity in result.entities {
        println!(
            "- {:?}: {} ({}:{})",
            entity.entity_type,
            entity.text,
            entity.start,
            entity.end
        );
    }
 
    Ok(())
}
```

--------------------------------

### Connect LanceDB to Lambda Ephemeral Storage (Rust)

Source: https://docs.rig.rs/guides/deploy/Blog_2_aws_lambda_lancedb

Connects a LanceDB instance to the temporary ephemeral storage available within an AWS Lambda execution environment. This is suitable for testing or specific use cases where data persistence across invocations is not required.

```rust
let db = lancedb::connect("/tmp").execute().await?;
```

--------------------------------

### Define FlightSearchTool and Implement Tool Trait in Rust

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This code defines the `FlightSearchTool` struct and implements the `Tool` trait. It specifies the tool's name, input/output types, and provides metadata through the `definition` function. The `call` function is stubbed out to indicate where the flight search logic will reside.

```Rust
pub struct FlightSearchTool;

impl Tool for FlightSearchTool {
    const NAME: &'static str = "search_flights";
 
    type Args = FlightSearchArgs;
    type Output = String;
    type Error = FlightSearchError;
 
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: Self::NAME.to_string(),
            description: "Search for flights between two airports".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "source": { "type": "string", "description": "Source airport code (e.g., 'JFK')" },
                    "destination": { "type": "string", "description": "Destination airport code (e.g., 'LAX')" },
                    "date": { "type": "string", "description": "Flight date in 'YYYY-MM-DD' format" },
                },
                "required": ["source", "destination"]
            }),
        }
    }
 
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        // We'll implement the logic for calling the flight search API next.
        Ok("Flight search results".to_string())
    }
}
```

--------------------------------

### Set OpenAI API Key Environment Variable

Source: https://docs.rig.rs/guides/rag/rag_system

Sets the OpenAI API key as an environment variable. This key is required for the Rig library to authenticate with the OpenAI API for generating embeddings.

```bash
export OPENAI_API_KEY=your_api_key_here
```

--------------------------------

### Handle Bot Mentions and Process Messages (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This Rust function handles the 'message' event, responding when the bot is mentioned. It extracts the user's query, processes it using the Rig agent, and sends back the response or an error message. It requires access to the bot's user ID from the TypeMap and the Rig agent's processing capabilities.

```Rust
async fn message(&self, ctx: Context, msg: Message) {
    if msg.mentions_me(&ctx.http).await.unwrap_or(false) {
        debug!("Bot mentioned in message: {}", msg.content);
 
        let bot_id = {
            let data = ctx.data.read().await;
            data.get::<BotUserId>().copied()
        };
 
        if let Some(bot_id) = bot_id {
            let mention = format!("<@{}>", bot_id);
            let content = msg.content.replace(&mention, "").trim().to_string();
 
            debug!("Processed content after removing mention: {}", content);
 
            match self.rig_agent.process_message(&content).await {
                Ok(response) => {
                    if let Err(why) = msg.channel_id.say(&ctx.http, response).await {
                        error!("Error sending message: {:?}", why);
                    }
                }
                Err(e) => {
                    error!("Error processing message: {:?}", e);
                    if let Err(why) = msg
                        .channel_id
                        .say(&ctx.http, format!("Error processing message: {:?}", e))
                        .await
                    {
                        error!("Error sending error message: {:?}", why);
                    }
                }
            }
        } else {
            error!("Bot user ID not found in TypeMap");
        }
    }
}
```

--------------------------------

### Content Processing with FileLoader

Source: https://docs.rig.rs/docs/concepts/loaders

Demonstrates reading file contents and applying error handling using FileLoader. The `read()` method fetches content, `ignore_errors()` skips files that fail to read, and `into_iter()` provides an iterator for further processing.

```rust
let processed_files = FileLoader::with_glob("*.txt")?
    .read()
    .ignore_errors()
    .into_iter()
    .collect::<Vec<_>>();
```

--------------------------------

### Check Max Tokens Requirement for Anthropic

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Illustrates a check within the Rig provider to ensure that the `max_tokens` parameter is set, as it is a mandatory field for Anthropic API requests.

```rust
let prompt_with_context = completion_request.prompt_with_context();

// Check if max_tokens is set, required for Anthropic
if completion_request.max_tokens.is_none() {
    return Err(CompletionError::RequestError(
        "max_tokens must be set for Anthropic".into(),
    ));
}
```

--------------------------------

### CompletionRequestBuilder for Fluent Request Construction

Source: https://docs.rig.rs/docs/concepts/completion

The `CompletionRequestBuilder` utilizes a fluent API to construct LLM requests, allowing customization of parameters like preamble, temperature, max tokens, documents, and tools before building the final request.

```rust
let request = model.completion_request("prompt")
    .preamble("system instructions")
    .temperature(0.7)
    .max_tokens(1000)
    .documents(context_docs)
    .tools(available_tools)
    .build();
```

--------------------------------

### Implement Custom Operation Trait in Rust

Source: https://docs.rig.rs/docs/concepts/chains

Demonstrates how to implement a custom operation by defining a struct and implementing the `Op` trait. The `call` method processes an input string, splits it into words, and returns them as a vector of strings.

```rust
struct CustomOp;

impl Op for CustomOp {
    type Input = String;
    type Output = Vec<String>;

    async fn call(&self, input: Self::Input) -> Self::Output {
        input.split_whitespace()
            .map(String::from)
            .collect()
    }
}
```

--------------------------------

### Process LanceDB Record Batches for JSON Output

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Demonstrates converting LanceDB query results, which are in Arrow RecordBatches, into a vector of JSON values. This involves error handling for LanceDB operations and deserialization.

```rust
} // Assuming this is the end of a block

impl QueryToJson for lancedb::query::VectorQuery {
    async fn execute_query(&self) -> Result<Vec<serde_json::Value>, VectorStoreError> {
        let record_batches = self
            .execute()
            .await
            .map_err(lancedb_to_rig_error)?
            .try_collect::<Vec<_>>()
            .await
            .map_err(lancedb_to_rig_error)?;

        record_batches.deserialize()

```

--------------------------------

### Implement Custom Adder Tool in Rust

Source: https://docs.rig.rs/docs/why_rig

This Rust code defines a custom tool named 'Adder' for Rig agents. It implements the `Tool` trait to handle addition operations, specifying the arguments, error types, and the tool's definition including its name, description, and JSON schema for parameters. The `call` method performs the actual addition.

```rust
use rig::tool::Tool;
use rig::completion::ToolDefinition;
use serde::{Deserialize, Serialize};
use serde_json::json;

// Define the arguments for the addition operation
#[derive(Deserialize)]
struct AddArgs {
    x: i32,
    y: i32,
}

// Define a custom error type for math operations
#[derive(Debug, thiserror::Error)]
#[error("Math error")]
struct MathError;

// Define the Adder struct
#[derive(Deserialize, Serialize)]
struct Adder;

// Implement the Tool trait for Adder
impl Tool for Adder {
    const NAME: &'static str = "add";

    type Error = MathError;
    type Args = AddArgs;
    type Output = i32;

    // Define the tool's interface
    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "add".to_string(),
            description: "Add two numbers".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "x": {
                        "type": "integer",
                        "description": "First number to add"
                    },
                    "y": {
                        "type": "integer",
                        "description": "Second number to add"
                    }
                },
                "required": ["x", "y"]
            }),
        }
    }

    // Implement the addition operation
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        Ok(args.x + args.y)
    }
}
```

--------------------------------

### Configure OpenTelemetry Collector for Rig

Source: https://docs.rig.rs/docs/concepts/observability

This configuration sets up an OpenTelemetry collector to receive traces via HTTP, transform span names for agent operations, and export them to Langfuse. It defines receivers, processors, and exporters for trace pipelines.

```yaml
receivers:
  otlp:
    protocols:
      http:
        # this is the default endpoint
        endpoint: 0.0.0.0:4318
 
processors:
  transform:
    trace_statements:
      - context: span
        statements:
          # Rename span if it's "invoke_agent" and has an agent attribute
          - set(name, attributes["gen_ai.agent.name"]) where name == "invoke_agent" and attributes["gen_ai.agent.name"] != nil
 
exporters:
  otlphttp/langfuse:
    endpoint: "https://cloud.langfuse.com/api/public/otel"
    headers:
      Authorization: "Basic ${AUTH_STRING}"
 
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [transform]
      exporters: [otlphttp/langfuse]
```

--------------------------------

### Perform Top-N Vector Search in Neo4j

Source: https://docs.rig.rs/docs/integrations/vector_stores/neo4j

Shows how to perform a top-N similarity search on a Neo4j vector index. This function retrieves the most similar nodes based on a given query vector and returns a specified number of results.

```rust
let results = index.top_n::<Movie>("a historical movie on quebec", 5).await?;

```

--------------------------------

### Define a Custom Tool Function (Rust)

Source: https://docs.rig.rs/docs/quickstart/tools

This Rust code defines a custom tool named 'add' that takes two integer arguments (x and y) and returns their sum. It implements the `Tool` trait from the `rig` library, specifying the tool's name, arguments, output, and the logic for its execution. It also defines the tool's schema for API interaction.

```rust
use rig_core::tool::{Tool, ToolDefinition};
use serde::{Deserialize, Serialize};
use rig_core::json;

#[derive(Deserialize)]
struct AddArgs {
    x: i32,
    y: i32,
}

#[derive(Deserialize, Serialize)]
struct Adder;

impl Tool for Adder {
    const NAME: &'static str = "add";
    type Error = MathError;
    type Args = AddArgs;
    type Output = i32;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "add".to_string(),
            description: "Add x and y together".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "First number" },
                    "y": { "type": "number", "description": "Second number" }
                }
            })
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        Ok(args.x + args.y)
    }
}

// Assuming MathError is defined elsewhere, e.g.:
#[derive(Debug)]
enum MathError { DivisionByZero }

```

--------------------------------

### Rust PDF Text Extraction Function

Source: https://docs.rig.rs/guides/rag/rag_system

Implements a function `load_pdf_content` to extract text from a PDF file using the `pdf-extract` crate. It utilizes `anyhow` for robust error handling, providing context for extraction failures.

```rust
use rig::providers::openai;
use std::path::Path;
use anyhow::{Result, Context};
use pdf_extract::extract_text;

// Function to load and extract text from a PDF file
fn load_pdf_content<P: AsRef<Path>>(file_path: P) -> Result<String> {
    extract_text(file_path.as_ref())
        .with_context(|| format!("Failed to extract text from PDF: {:?}", file_path.as_ref()))
}
```

--------------------------------

### Define Anthropic API Versions

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Provides constants for specifying Anthropic API versions. These are used during client configuration to ensure compatibility.

```rust
pub const ANTHROPIC_VERSION_2023_01_01: &str = "2023-01-01";
pub const ANTHROPIC_VERSION_2023_06_01: &str = "2023-06-01";
pub const ANTHROPIC_VERSION_LATEST: &str = ANTHROPIC_VERSION_2023_06_01;
```

--------------------------------

### Building Embeddings with EmbeddingsBuilder in Rust

Source: https://docs.rig.rs/docs/concepts/embeddings

Illustrates using `EmbeddingsBuilder` to process multiple documents for embedding generation. It requires importing the `EmbeddingsClient` trait and specifies the embedding model to use, such as OpenAI's 'text-embedding-ada-002'.

```rust
// required trait import for embedding_model fn to exist
use rig::client::embeddings::EmbeddingsClient;
let documents = vec![
    Foo {
        id: 1,
        name: "Rig".to_string()
    },
    Foo {
        id: 2,
        name: "Playgrounds".to_string()
    }
];

let model = rig::providers::openai::Client::from_env().embedding_model("text-embedding-ada-002");

let embeddings = EmbeddingsBuilder::new(model)
    .documents(documents)?
    .build()
    .await?;
```

--------------------------------

### Anthropic Tool Definition Structure

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Defines the `ToolDefinition` struct for specifying tools that can be used with Anthropic models, including name and description.

```rust
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: Option<String>,
```

--------------------------------

### Insert Documents into Vector Store

Source: https://docs.rig.rs/docs/integrations/vector_stores/surrealdb

Embeds and inserts documents into the SurrealDB vector store. The `documents` variable should be a collection of items that implement the `Embed` trait. This operation requires the `VectorStoreIndex` trait implementation.

```rust
use rig::vector_store::VectorStoreIndex;

// Assuming 'vector_store' is initialized and 'documents' are prepared
vector_store.insert_documents(documents).await?;

```

--------------------------------

### Define CompletionModel Trait in Rust

Source: https://docs.rig.rs/guides/extension/write_your_own_provider

Defines the `CompletionModel` trait for handling chat completions. It specifies associated types for responses and streaming responses, and requires methods for `completion` and `stream` operations. This trait is fundamental for creating custom completion model implementations.

```rust
pub trait CompletionModel:
    Clone
    + Send
    + Sync {
    type Response: Send + Sync + Serialize + DeserializeOwned;
    type StreamingResponse: Clone + Unpin + Send + Sync + Serialize + DeserializeOwned + GetTokenUsage;
 
    // Required methods
    fn completion(
        &self,
        request: CompletionRequest,
    ) -> impl Future<Output = Result<CompletionResponse<Self::Response>, CompletionError>> + Send;
 
    fn stream(
        &self,
        request: CompletionRequest,
    ) -> impl Future<Output = Result<StreamingCompletionResponse<Self::StreamingResponse>, CompletionError>> + Send;
}
```

--------------------------------

### Anthropic Token Usage Structure

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Defines the structure for tracking token usage in Anthropic API responses, including input tokens, output tokens, and cache statistics.

```rust
pub input_tokens: u64,
pub cache_read_input_tokens: Option<u64>,
pub cache_creation_input_tokens: Option<u64>,
pub output_tokens: u64,

impl std::fmt::Display for Usage {
```

--------------------------------

### Implement EventHandler Trait for Discord Bot in Rust

Source: https://docs.rig.rs/guides/advanced/discord_bot

Implements the `EventHandler` trait for the `Handler` struct, defining methods to manage Discord events such as `interaction_create`, `message`, and `ready`. This enables the bot to respond to user interactions, incoming messages, and signify its readiness.

```rust
#[async_trait]
impl EventHandler for Handler {
    async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
        // ... handle interactions
    }
 
    async fn message(&self, ctx: Context, msg: Message) {
        // ... handle messages
    }
 
    async fn ready(&self, ctx: Context, ready: Ready) {
        // ... handle readiness
    }
}
```

--------------------------------

### Top N Search Implementation (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/mongodb

An asynchronous function `top_n` within the `MongoDbVectorIndex` that takes a query string and a number `n`, returning the top `n` most similar documents based on vector embeddings.

```rust
    ///     .top_n::<Definition>("My boss says I zindle too much, what does that mean?", 1)
    ///     .await?;
    /// ```
    async fn top_n<T: for<'a> Deserialize<'a> + Send>(
        &self,
        query: &str,
        n: usize,
    ) -> Result<Vec<(f64, String, T)>, VectorStoreError> {
        let prompt_embedding = self.model.embed_text(query).await?;

        let mut cursor = self
            .collection
            .aggregate([

```

--------------------------------

### CompletionModel Trait for LLM Provider Implementation

Source: https://docs.rig.rs/docs/concepts/completion

The `CompletionModel` trait defines the interface for implementing LLM providers, handling raw request and response parsing, and managing errors. It is crucial for integrating custom or third-party models.

```rust
pub trait CompletionModel: Clone + Send + Sync {
    type Response: Send + Sync;

    fn completion(
        &self,
        request: CompletionRequest,
    ) -> impl std::future::Future<Output = Result<CompletionResponse<Self::Response>, CompletionError>>
           + Send;

    fn completion_request(&self, prompt: &str) -> CompletionRequestBuilder<Self> {
        CompletionRequestBuilder::new(self.clone(), prompt.to_string())
    }
}
```

--------------------------------

### Anthropic Completion Model Structure

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Defines the `CompletionModel` struct used by the Rig provider for interacting with Anthropic's completion endpoints, holding the client and model name.

```rust
}

#[derive(Clone)]
pub struct CompletionModel {
    client: Client,
    pub model: String,
}
```

--------------------------------

### Configure Multi-turn Interactions for Agents in Rig RS

Source: https://docs.rig.rs/docs/concepts/agent

This snippet shows how to extend the maximum number of turns an agent can take, which is crucial for agents that utilize multiple tools. The `.multi_turn()` function allows specifying the number of additional turns to prevent `MaxDepthError`.

```rust
let res = tool_agent
    .prompt("Please calculate 2+5")
    .multi_turn(1)
    .send()
    .await?;
 
println!("{res}");
```

--------------------------------

### Define In-Memory Vector Store Structure (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/in_memory

Defines the core data structure for the InMemoryVectorStore, which uses a HashMap to store documents and their associated embeddings. It supports multiple embeddings per document via the OneOrMany enum.

```rust
pub struct InMemoryVectorStore<D: Serialize> {
    embeddings: HashMap<String, (D, OneOrMany<Embedding>)>
}

pub enum OneOrMany<T> {
    One(T),
    Many(Vec<T>)
}
```

--------------------------------

### Define Data Structures for News Article Analysis (Rust)

Source: https://docs.rig.rs/guides/text_extraction_classification

Defines the Rust data structures `Topic` and `NewsArticleAnalysis` to hold the results of a news article analysis. These structures are derived with traits for debugging, serialization, and JSON schema generation, making them suitable for use with LLM extraction tasks.

```rust
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
enum Topic {
    Politics,
    Technology,
    Sports,
    Entertainment,
    Other(String),
}

#[derive(Debug, Deserialize, Serialize, JsonSchema)]
struct NewsArticleAnalysis {
    topic: Topic,
    sentiment: SentimentClassification,
    entities: Vec<Entity>,
    key_points: Vec<String>,
}
```

--------------------------------

### ProviderClient Trait Definition in Rust

Source: https://docs.rig.rs/docs/concepts/provider_clients

Defines the `ProviderClient` trait in Rust, which is essential for creating clients for different LLM or model providers within the Rig framework. It requires several other traits for specific model functionalities.

```rust
pub trait ProviderClient:
    AsCompletion + AsTranscription + AsEmbeddings + AsImageGeneration + AsAudioGeneration + Debug
{
    /// Create a client from the process's environment.
    /// Panics if an environment is improperly configured.
    fn from_env() -> Self
    where
        Self: Sized;

    // .. there are other methods here, but as they already have a default implementation
    // for the most part we don't need to concern ourselves with them
}
```

--------------------------------

### Named Entity Recognition Data Structures in Rust

Source: https://docs.rig.rs/guides/text_extraction_classification

Defines the data structures required for named entity recognition (NER) using Rig RS. It includes an enum for entity types (Person, Organization, Location) and a struct for individual entities, along with a struct to hold a collection of extracted entities.

```rust
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
enum EntityType {
    Person,
    Organization,
    Location,
}
 
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
struct Entity {
    text: String,
    entity_type: EntityType,
    start: usize,
    end: usize,
}
 
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
struct ExtractedEntities {
    entities: Vec<Entity>,
}
```

--------------------------------

### Define CompletionResponse Structure (Rust)

Source: https://docs.rig.rs/docs/concepts/completion

Defines the structured response type for completions, including message and tool call variants. It uses generics for the raw response type.

```rust
enum ModelChoice {
    Message(String),
    ToolCall(String, Value)
}

struct CompletionResponse<T> {
    choice: ModelChoice,
    raw_response: T,
}
```

--------------------------------

### Automatic Deserialization from Arrow RecordBatch to JSON Value in Rust

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Implements automatic deserialization of Arrow `RecordBatch` items into a vector of `serde_json::Value`. This trait leverages the `arrow-array` and `serde_json` crates to handle the conversion, enabling seamless integration with data returned from LanceDB queries. It includes error handling for Arrow-specific errors, converting them to `VectorStoreError`.

```rust
use std::sync::Arc;

use arrow_array::{
    cast::AsArray,
    types::*,
    Array, ArrowPrimitiveType, OffsetSizeTrait, RecordBatch, RunArray, StructArray, UnionArray,
};
use lancedb::arrow::arrow_schema::{ArrowError, DataType, IntervalUnit, TimeUnit};
use rig::vector_store::VectorStoreError;
use serde::Serialize;
use serde_json::{json, Value};

use crate::serde_to_rig_error;

fn arrow_to_rig_error(e: ArrowError) -> VectorStoreError {
    VectorStoreError::DatastoreError(Box::new(e))
}

/// Trait used to deserialize data returned from LanceDB queries into a serde_json::Value vector.
/// Data returned by LanceDB is a vector of `RecordBatch` items.
pub(crate) trait RecordBatchDeserializer {
    fn deserialize(&self) -> Result<Vec<serde_json::Value>, VectorStoreError>;
}

impl RecordBatchDeserializer for Vec<RecordBatch> {
    fn deserialize(&self) -> Result<Vec<serde_json::Value>, VectorStoreError> {
        Ok(self
            .iter()
            .map(|record_batch| record_batch.deserialize())
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .flatten()
            .collect())
    }
}

```

--------------------------------

### Derive Embed Trait for Structs in Rust

Source: https://docs.rig.rs/docs/concepts/embeddings

Demonstrates how to use the `#[derive(Embed)]` macro to automatically implement the `Embed` trait for a Rust struct. This simplifies the process of making a type embeddable. Ensure the `derive` feature of `rig-core` is enabled.

```rust
#[derive(Embed)]
struct Foo {
    id: i32,
    #[embed]
    name: String
}
```

--------------------------------

### Define LanceDB Schema with Embeddings

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Defines the schema required by LanceDB for storing embeddings. It includes fields for 'id', 'definition', and 'embedding' with a specified dimension.

```rust
Schema::new(Fields::from(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("definition", DataType::Utf8, false),
        Field::new(
            "embedding",
            DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float64, true)),
                dims as i32,
            ),
            false,
        ),
    ]))
}
```

--------------------------------

### Custom Rust Layer for Log-Only Output with Tracing Subscriber

Source: https://docs.rig.rs/docs/concepts/observability

A custom Rust `tracing` subscriber layer that filters events to only output the message content, excluding span fields and metadata. This is useful for reducing log verbosity when full span details are not required. It requires the `tracing` and `tracing-subscriber` crates.

```rust
#[derive(Clone)]
struct MessageOnlyLayer;

implement<S>
    Layer<S>
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    fn on_event(&self, event: &tracing::Event<'_>, _ctx: Context<'_, S>) {
        use tracing::field::{Field, Visit};

        struct MessageVisitor {
            message: Option<String>,
        }

        impl Visit for MessageVisitor {
            fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
                if field.name() == "message" {
                    self.message = Some(format!("{:?}", value));
                }
            }
        }

        let mut visitor = MessageVisitor { message: None };
        event.record(&mut visitor);

        if let Some(msg) = visitor.message {
            let msg = msg.trim_matches('"');
            let metadata = event.metadata();

            let colored_level = match metadata.level() {
                &tracing::Level::TRACE => "\x1b[35mTRACE\x1b[0m", // Purple
                &tracing::Level::DEBUG => "\x1b[34mDEBUG\x1b[0m", // Blue
                &tracing::Level::INFO => "\x1b[32m INFO\x1b[0m",  // Green
                &tracing::Level::WARN => "\x1b[33m WARN\x1b[0m",  // Yellow
                &tracing::Level::ERROR => "\x1b[31mERROR\x1b[0m", // Red
            };
            let _ = writeln!(std::io::stdout(), "{colored_level} {msg}");
        }
    }
}

// To use, you would ideally place it after an `EnvFilter` like so:
// tracing_subscriber::registry()
//     .with(EnvFilter::new("info"))
//     .with(MessageOnlyLayer)
//     .init();

```

--------------------------------

### Completion Trait for Low-Level LLM Control

Source: https://docs.rig.rs/docs/concepts/completion

The `Completion` trait offers fine-grained control over LLM requests, allowing access to raw completion responses and handling tool calls. It is a low-level interface for advanced customization.

```rust
fn completion(
        &self,
        prompt: &str,
        chat_history: Vec<Message>,
    ) -> impl std::future::Future<Output = Result<CompletionRequestBuilder<M>, CompletionError>> + Send;
```

--------------------------------

### SubmitTool Implementation in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Implements the `Tool` trait for `SubmitTool` in Rust, which is used by the Extractor system for submitting structured data. It defines the tool's name, error type, arguments, and output, and includes methods for defining the tool's schema and calling it.

```rust
impl<T: JsonSchema + for<'a> Deserialize<'a> + Serialize + Send + Sync> Tool for SubmitTool<T> {
    const NAME: &'static str = "submit";
    type Error = SubmitError;
    type Args = T;
    type Output = T;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: Self::NAME.to_string(),
            description: "Submit the structured data you extracted from the provided text.".to_string(),
            parameters: json!(schema_for!(T)),
        }
    }

    async fn call(&self, data: Self::Args) -> Result<Self::Output, Self::Error> {
        Ok(data)
    }
}
```

--------------------------------

### Batch Processing Documents in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Provides a function for batch processing multiple documents using a pre-configured Extractor. It iterates through a vector of document strings, extracts data from each, and collects the results, handling potential extraction errors for each document.

```rust
async fn process_documents(extractor: &Extractor<Model, DataType>, docs: Vec<String>) -> Vec<Result<DataType, ExtractionError>> {
    let mut results = Vec::new();
    for doc in docs {
        results.push(extractor.extract(&doc).await);
    }
    results
}
```

--------------------------------

### Define BotUserId TypeMapKey (Rust)

Source: https://docs.rig.rs/guides/advanced/discord_bot

This Rust code defines a `BotUserId` struct that implements Serenity's `TypeMapKey` trait. This is used to store and retrieve the bot's user ID within Serenity's `TypeMap`, a type-safe key-value store for sharing data across event handlers in a Discord bot.

```rust
struct BotUserId;

impl TypeMapKey for BotUserId {
    type Value = serenity::model::id::UserId;
}
```

--------------------------------

### Combined Data Structure for Text Analysis in Rust

Source: https://docs.rig.rs/guides/text_extraction_classification

Defines a consolidated data structure `TextAnalysis` for performing multiple NLP tasks simultaneously. This structure includes fields for sentiment classification (SentimentClassification) and extracted entities (Vec<Entity>), allowing for a unified output.

```rust
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
struct TextAnalysis {
    sentiment: SentimentClassification,
    entities: Vec<Entity>,
}
```

--------------------------------

### Chat Trait for Conversational LLM Interactions

Source: https://docs.rig.rs/docs/concepts/completion

The `Chat` trait enables conversation-aware LLM interactions by maintaining chat history and supporting contextual responses. It is a high-level interface for chat-based applications.

```rust
async fn chat(&self, prompt: &str, history: Vec<Message>) -> Result<String, PromptError>;
```

--------------------------------

### Define CompletionError Enum (Rust)

Source: https://docs.rig.rs/docs/concepts/completion

Defines comprehensive error types for handling various issues during completion requests. It covers HTTP, JSON, request, response, and provider-specific errors.

```rust
enum CompletionError {
    HttpError(reqwest::Error),
    JsonError(serde_json::Error),
    RequestError(Box<dyn Error>),
    ResponseError(String),
    ProviderError(String),
}
```

--------------------------------

### MongoDbVectorIndex Struct Definition (Rust)

Source: https://docs.rig.rs/docs/integrations/vector_stores/mongodb

Defines the `MongoDbVectorIndex` struct, which is the central component for interacting with MongoDB's vector search. It holds the collection, embedding model, index name, and search parameters.

```rust
/// The `MongoDbVectorIndex` struct is the core component for interacting with MongoDB's vector search capabilities.
/// It encapsulates the MongoDB collection, the embedding model, and the index name, along with search parameters.
///
/// ```rust
/// pub struct MongoDbVectorIndex {
///     collection: Collection<Document>,
///     model: Box<dyn EmbeddingModel>,
///     index_name: String,
///     search_params: SearchParams,
/// }
/// ```
///
/// - `collection`: The MongoDB collection where documents are stored.
/// - `model`: The embedding model used to generate vector representations of text.
/// - `index_name`: The name of the vector index in MongoDB.
/// - `search_params`: Parameters for customizing the search behavior.
pub struct MongoDbVectorIndex {
    collection: Collection<Document>,
    model: Box<dyn EmbeddingModel>,
    index_name: String,
    search_params: SearchParams,
}
```

--------------------------------

### Define Data Structures for Sentiment Classification

Source: https://docs.rig.rs/guides/text_extraction_classification

This Rust code defines the data structures required for sentiment analysis using Rig. It includes an enum for sentiment categories (Positive, Negative, Neutral) and a struct to hold the classification result, including confidence score. These structures are derived to support JSON serialization/deserialization and schema generation.

```rust
use serde::{Deserialize, Serialize};
use schemars::JsonSchema;
use rig::providers::openai;
use rig::extractor::Extractor;
use anyhow::Result;
 
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
enum Sentiment {
    Positive,
    Negative,
    Neutral,
}
 
#[derive(Debug, Deserialize, Serialize, JsonSchema)]
struct SentimentClassification {
    sentiment: Sentiment,
    confidence: f32,
}
```

--------------------------------

### Define Handler Struct for Rig Agent in Rust

Source: https://docs.rig.rs/guides/advanced/discord_bot

Defines the `Handler` struct which encapsulates a thread-safe reference-counted pointer (`Arc`) to the `RigAgent`. This struct is central to managing Discord events and interactions, allowing shared access to the Rig agent across different event handlers.

```rust
struct Handler {
    rig_agent: Arc<RigAgent>,
}
```

--------------------------------

### Define RigAgent Struct in rig_agent.rs

Source: https://docs.rig.rs/guides/advanced/discord_bot

Defines the `RigAgent` struct in Rust, which encapsulates the core logic for managing Retrieval-Augmented Generation (RAG) interactions. It holds an `Arc` pointer to a `RagAgent`, enabling thread-safe sharing of the agent's state and capabilities.

```rust
pub struct RigAgent {
    rag_agent: Arc<RagAgent<openai::CompletionModel, rig::vector_store::InMemoryVectorIndex<openai::EmbeddingModel>, rig::vector_store::NoIndex>>,
}

```

--------------------------------

### Define Extractor Structure in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Defines the generic Extractor struct in Rust, which is responsible for extracting structured data from text using an LLM Agent. It requires the model to implement `CompletionModel` and the target data structure to implement `JsonSchema`, `Deserialize`, and be `Send + Sync`.

```rust
/// Extractor for structured data from text
pub struct Extractor<M: CompletionModel, T: JsonSchema + for<'a> Deserialize<'a> + Send + Sync> {
    agent: Agent<M>,
    _t: PhantomData<T>,
}
```

--------------------------------

### Define Custom Error Type for Flight Search

Source: https://docs.rig.rs/guides/advanced/flight_assistant

This Rust code defines a custom error enum `FlightSearchError` using the `thiserror` crate. It provides specific error variants for HTTP request failures, invalid responses, API errors, and missing API keys, facilitating robust error handling.

```rust
#[derive(Debug, thiserror::Error)]
pub enum FlightSearchError {
    #[error("HTTP request failed: {0}")]
    HttpRequestFailed(String),
    #[error("Invalid response structure")]
    InvalidResponse,
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Missing API key")]
    MissingApiKey,
}
```

--------------------------------

### Anthropic Content Types Enum

Source: https://docs.rig.rs/docs/integrations/model_providers/anthropic

Defines an enum to represent different content types returned by the Anthropic API, including plain strings, text objects, and tool usage information.

```rust
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum Content {
    String(String),
    Text {
        r#type: String,
        text: String,
    },
    ToolUse {
        r#type: String,
        id: String,
        name: String,
        input: serde_json::Value,
    },
```

--------------------------------

### Filter LanceDB Schema Columns for Embeddings

Source: https://docs.rig.rs/docs/integrations/vector_stores/lancedb

Provides a trait `FilterTableColumns` to filter schema fields, returning only those that represent embeddings (FixedSizeList of Float64). This is useful for optimizing data handling.

```rust
} // Assuming this is the end of a block

/// Filter out the columns from a table that do not include embeddings. Return the vector of column names.
pub(crate) trait FilterTableColumns {
    fn filter_embeddings(self) -> Vec<String>;
}

impl FilterTableColumns for Arc<Schema> {
    fn filter_embeddings(self) -> Vec<String> {
        self.fields()
            .iter()
            .filter_map(|field| match field.data_type() {
                DataType::FixedSizeList(inner, ..) => match inner.data_type() {
                    DataType::Float64 => None,

```

--------------------------------

### Extraction Error Enum in Rust

Source: https://docs.rig.rs/docs/concepts/extractors

Defines the `ExtractionError` enum in Rust, used for comprehensive error handling within the Rig Extractor system. It covers cases like no data extracted, deserialization failures, and prompt-related errors.

```rust
#[derive(Debug, thiserror::Error)]
pub enum ExtractionError {
    #[error("No data extracted")]
    NoData,

    #[error("Failed to deserialize the extracted data: {0}")]
    DeserializationError(#[from] serde_json::Error),

    #[error("PromptError: {0}")]
    PromptError(#[from] PromptError),
}
```

=== COMPLETE CONTENT === This response contains all available snippets from this library. No additional content exists. Do not make further requests.