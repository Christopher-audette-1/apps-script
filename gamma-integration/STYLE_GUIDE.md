# Gamma Presentation Outline Style Guide

This guide explains how to structure your Google Doc and manage settings to create presentations with the "Send to Gamma" script.

## Initial Setup

Before you begin, you need to configure two things: your Gamma API Key and your Gamma Template(s).

### 1. Set Your API Key

1.  Go to the **Send to Gamma** menu.
2.  Select **Set API Key**.
3.  Paste your API key into the dialog and click "Save". You only need to do this once.

### 2. Add a Template

You can add multiple Gamma templates and switch between them easily.

1.  Go to the **Send to Gamma** menu.
2.  Select **Add/Manage Templates**.
3.  A dialog will appear asking for a **Template Name** and a **Template ID**.
    *   **Template Name:** A friendly name you'll recognize (e.g., "Quarterly Review Deck", "Marketing Pitch").
    *   **Template ID:** This is a unique identifier from Gamma.

#### How to Find Your Gamma Template ID

1.  Open your desired template in Gamma.
2.  Look at the URL in your browser's address bar.
3.  The URL will look something like this: `https://gamma.app/docs/Untitled-g_xxxxxxxxxxxxxx`
4.  The Template ID is the part that starts with `g_` (e.g., `g_xxxxxxxxxxxxxx`).
5.  Copy this ID and paste it into the "Template ID" field in the Google Doc dialog.

4.  Click "Save Template". You can add as many templates as you like by repeating this process.

## Creating a Presentation

Once set up, creating a presentation is simple.

1.  Go to the **Send to Gamma** menu and select **Create Presentation**.
2.  A dialog will appear with two options:
    *   **Select Gamma Template:** A dropdown menu will show all the templates you have added. Choose the one you want to use for this presentation.
    *   **Detailed Instructions:** This box will be pre-filled with the "preset instructions" from the end of your document (see below). You can edit them here for this specific presentation without changing the document's preset.
3.  Click **Create Presentation**. The script will send your outline to Gamma.
4.  A link to the newly created Gamma presentation will be inserted at the top of your Google Doc.

## Document Structure

The script relies on the structure of your Google Doc to create the slides. Here's how to format your document:

*   **Presentation Title:** The first line of your document should be the main title of your presentation. Use the **Title** style in Google Docs for this.
*   **Slide Breaks:** To create a new slide, insert a **Horizontal Rule** from the "Insert" menu in Google Docs.
*   **Slide Titles and Subtitles:**
    *   Use **Heading 1** for the main title of a slide.
    *   Use **Heading 2** for subtitles or section headers within a slide.
*   **Bulleted Lists:** Use standard Google Docs bullet points to create lists.
*   **Paragraphs:** Normal text will be treated as paragraphs.

## Preset Instructions

This template can include preset "Detailed Instructions" that control the overall style and layout of the presentation. These instructions are automatically loaded when you run the "Send to Gamma" script.

### Editing the Preset Instructions

To edit the preset instructions for this template:

1.  Scroll to the bottom of this document.
2.  The preset instructions are all the text that appears *after* the very last horizontal rule.
3.  You can edit this text to change the default instructions for this template.

## Example

Here is an example of a well-structured outline:

**[Title] My Startup Pitch**

---

**[Heading 1] Introduction**

*   Welcome to the future of...
*   Our mission is to revolutionize the...

---

**[Heading 1] The Problem**

**[Heading 2] The Market is Underserved**

The current solutions are outdated and inefficient...

---

[...more slides...]

---

Make the tone of this presentation professional and inspiring. The target audience is a group of potential investors. Use a minimalist black and white theme. All images should be photorealistic.
