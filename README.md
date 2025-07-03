# StreamVLM

A real-time video analysis app that uses VLMs to analze your webcam feed. Incorporates context from previous frames to current frames to enhance video understanding.

## What it does

StreamVLM captures frames from your camera and sends them to VLM models like GPT, Claude, and Gemini for analysis. The app can:

- Describe what it sees in each frame
- Track changes over time using temporal context
- Generate summaries of longer video sequences


## Features

- **Real-time Analysis**: Live camera feed processing with configurable query rates
- **Multiple AI Models**: Support for OpenAI GPT, Anthropic Claude, and Google Gemini
- **Temporal Context**: AI remembers previous frames to provide better analysis
- **Web Interface**: UI built with React and Tailwind CSS
- **Customizable Settings**: Adjust model parameters, prompts, and processing intervals
- **Misc**: WebSocket Streaming, Session Management

## Tech Stack

Python, FastAPI, TypeScript, React

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- Camera access
- API keys for at least one VLM provider (OpenAI, Anthropic, or Google)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ksh35/StreamVLM
   cd StreamVLM
   ```

2. **Set up the backend**
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   ```

3. **Set up the frontend**
   ```bash
   # Install Node.js dependencies
   npm install
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   python -m backend.run
   ```

2. **Start the frontend development server**
   ```bash
   npm run dev
   ```

3. **Open your browser**
   Navigate to `http://localhost:3000`

### Configuration

Before you can use StreamVLM, you'll need to configure your API key for at least one provider:

1. **OpenAI API Key** (for GPT-4o models)
   - Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Add it in the "API Keys" button in the app or add it directly to the `.env` file in this format: `OPENAI_API_KEY=your-key-here`

2. **Anthropic API Key** (for Claude models)
   - Get your key from [Anthropic Console](https://console.anthropic.com/)
   - Add it in the "API Keys" button in the app or add it directly to the `.env` file in this format: `ANTHROPIC_API_KEY=your-key-here`

3. **Google API Key** (for Gemini models)
   - Get your key from [Google AI Studio](https://aistudio.google.com/)
   - Add it in the "API Keys" button in the app or add it directly to the `.env` file in this format: `GOOGLE_API_KEY=your-key-here`

## Usage

1. **Connect your camera**
   - Click "Start" in the Camera View panel
   - Select your preferred camera device if multiple are available
   - Optional: Use OBS to spoof your webcam if you want to run the app on videos outside of your webcam. Or open a PR to add this functionality natively.

2. **Configure analysis settings**
   - Choose your preferred AI model
   - Set your analysis prompt (e.g., "Describe what you see in this image")
   - Adjust processing parameters like temperature and max tokens

3. **Start analysis**
   - Click "Start Analysis" to begin real-time processing
   - The app will use a VLM to analyze each frame and display results in the Analysis Panel

4. **View results**
   - Real-time responses appear in the analysis panel
   - Frame history shows previous analyses
   - Session statistics track processing metrics

5. **Generate Summary**
    - Click "Generate Summary" to get a summary of the last X frames
    - The summary prompt can be modified in the UI, but it's recommeded to keep it default


## API Endpoints

The backend provides several REST endpoints:

- `GET /health` - Check backend status
- `GET /api/models` - List available VLM models
- `POST /api/vlm/query` - Single image analysis
- `POST /api/vlm/query-with-context` - Analysis with temporal context
- `POST /api/session` - Session management
- `GET /api/settings` - Get default settings

WebSocket endpoint:
- `ws://localhost:8000/ws` - Real-time communication

## Development

### Adding New VLM Providers

To add support for a new VLM provider:

1. Add the provider and its models to VLMServices.__init__()
    - Add your provider’s API key to self.api_keys.
    - Add your model(s) to self.available_models with the correct provider name, description, and capabilities (e.g., "supports_images", "supports_text").
2. Implement the query method(s) in VLMServices
    - Add a method like _query_<provider> for image+prompt queries.
    - If your provider supports text-only summaries, also add _query_<provider>_text_only.
3. Update the main query router in VLMServices
    - In query_model, add a branch for your provider to call your new method.
    - In _query_text_only, add a branch for your provider if it supports text-only queries.
4. Update API key validation logic
    - Make sure your provider is included in self.api_keys and _validate_api_key.

Feel free to open a PR to include more models.

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

