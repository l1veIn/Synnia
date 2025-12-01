use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "action", content = "params")]
pub enum GraphAction {
    #[serde(rename = "create_node")]
    CreateNode {
        #[serde(rename = "type")]
        node_type: String, // "Image", "Text", "Prompt"
        label: String,
        description: String, // This will go into preview/payload
    },
    #[serde(rename = "message")]
    Message {
        text: String
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Candidate {
    content: Content,
}

#[derive(Serialize, Deserialize, Debug)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Part {
    text: String,
}

fn render_template(template: &str, inputs: &Value) -> String {
    let mut result = template.to_string();
    if let Value::Object(map) = inputs {
        for (key, value) in map {
            // format!("{{{{{}}}}}", key) produces "{{key}}"
            let placeholder = format!("{{{{{}}}}}", key); 
            let replacement = match value {
                Value::String(s) => s.clone(),
                _ => value.to_string(),
            };
            result = result.replace(&placeholder, &replacement);
        }
    }
    result
}

/// Call Gemini with dynamic agent configuration
pub async fn call_gemini_agent(
    api_key: &str, 
    base_url: &str,
    model_name: &str,
    agent_system_prompt: &str, 
    inputs: Value,             
    context_nodes: String      
) -> Result<Vec<GraphAction>, String> {
    
    // 1. Render the Agent's Prompt
    let rendered_persona = render_template(agent_system_prompt, &inputs);

    // 2. Construct the MASTER System Instruction
    let master_system_instruction = format!(r#" 
    You are an AI Agent within the Synnia creative environment.
    
    YOUR CORE INSTRUCTION (PERSONA):
    {}
    
    YOUR TOOLKIT (ACTIONS):
    You can effect change in the world by outputting a JSON Array of actions.
    1. 'create_node': Create a new asset. Params: {{ "type": "Text"|"Image"|"Prompt", "label": "Short Title", "description": "Content or Prompt" }}
    2. 'message': Speak to the user. Params: {{ "text": "..." }}

    OUTPUT RULES:
    - OUTPUT ONLY RAW JSON. No markdown blocks. No prose before/after.
    - STRICTLY follow the action schema.
    
    Example Output:
    [
      {{ "action": "message", "params": {{ "text": "Here are three concepts based on your request." }} }},
      {{ "action": "create_node", "params": {{ "type": "Text", "label": "Concept A", "description": "..." }} }}
    ]
    "#, rendered_persona);

    // 3. Clean base url
    let clean_base = base_url.trim_end_matches('/');
    let url = format!(
        "{}/v1beta/models/{}:generateContent?key={}",
        clean_base,
        model_name,
        api_key
    );

    // 4. Construct Body
    let full_user_message = format!("Context:\n{}\n\nExecute your task.", context_nodes);

    // JSON macro uses standard JSON syntax, NO escaping needed for braces unless inside string literals
    let payload = json!({
        "contents": [{
            "role": "user",
            "parts": [{ "text": full_user_message }]
        }],
        "systemInstruction": {
            "parts": [{ "text": master_system_instruction }]
        },
        "generationConfig": {
            "temperature": 0.7,
            "responseMimeType": "application/json"
        }
    });

    // 5. Network Call
    let client = reqwest::Client::new();
    let res = client.post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("API Error: {}", res.text().await.unwrap_or_default()));
    }

    let gemini_res: GeminiResponse = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
    
    let text = gemini_res.candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content.parts.into_iter().next())
        .map(|p| p.text)
        .ok_or("No content generated")?;

    let clean_json = text.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```");

    let actions: Vec<GraphAction> = serde_json::from_str(clean_json)
        .map_err(|e| format!("Failed to parse agent actions: {}. Raw: {}", e, clean_json))?;

    Ok(actions)
}
