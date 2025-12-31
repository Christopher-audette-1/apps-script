# Setup Instructions for Call Summarizer

To use the Call Summarizer script, you must first securely set your Gemini API key. This is a one-time setup process.

## Steps

1.  **Open the Apps Script Project:**
    *   Open the Google Sheet associated with this project.
    *   Go to `Extensions > Apps Script`. This will open the script editor in a new tab.

2.  **Select the Correct Script:**
    *   Make sure you are viewing the `call-summarizer` project. The project title should be visible at the top left of the editor.

3.  **Run the Setup Function:**
    *   In the function dropdown menu at the top of the editor, select the function named `DO_THIS_ONCE_setApiKey`.
    *   Click the **Run** button.

4.  **Enter Your API Key:**
    *   A prompt dialog will appear with the title "Set Gemini API Key".
    *   Paste your valid Gemini API key into the text box.
    *   Click **OK**.

5.  **Authorization (First Time Only):**
    *   If this is your first time running the script, Google will ask for authorization.
    *   Follow the on-screen prompts to grant the necessary permissions to the script.

6.  **Confirmation:**
    *   You should see a confirmation message indicating that the API key has been set successfully.

Your Gemini API key is now securely stored, and the `processNewCallFiles` function will be able to run automatically.
