# Claufree

This project is a **Puter.js chatbot starter**.

## Important

This project does **not** bypass paid services and does not provide unauthorized access to any model.

Use legal/free options instead:

- Puter-supported models through user-authenticated usage
- Any endpoint or model you are allowed to use

## Quick start

1. Open this folder in VS Code.
2. Run a local web server (for example with the Live Server extension).
3. Open the app in your browser.
4. Select a model from the dropdown.
5. Start chatting.

Note: Puter.js does not support loading directly via `file:///`. Use a local server.

## Features

- Dedicated start page that introduces Claufree as open source
- Local Claufree sign-in (name/email/consent)
- Profile context is included in Puter chat requests
- Model picker using `puter.ai.listModels()`
- Chat completion via `puter.ai.chat()`
- Chat history saved in local storage
- New chat reset button
- Model refresh button

## Sign-in behavior

- The start screen uses a Claufree sign-in form (not a Puter login form).
- Your profile data (name/email if provided) is saved in your browser and attached as context in requests sent to Puter.
- Depending on model access rules, Puter may still require account authentication for some requests.

## Security checklist

- This project has no server secrets in code, so it is generally safe to publish to GitHub.
- No frontend app can be guaranteed "unhackable". Keep dependencies updated and enforce HTTPS.
- Profile and chat data are stored in browser local storage. Use the Clear local data action to wipe it.
- Image upload is limited to common image formats and a size cap in the app logic.
- A CSP is included in `index.html` to reduce script-injection risk.

## Files

- `index.html` - chat interface
- `styles.css` - UI styles
- `app.js` - chat behavior and Puter API wiring
- `config.example.js` - legacy sample config (not required for Puter mode)

## Notes

- Keep any secrets private.
- Never commit real credentials.
