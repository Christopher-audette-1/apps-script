# Gamma Presentation Outline Style Guide

This guide explains how to structure your Google Doc and use the built-in tools to create presentations with the "Send to Gamma" script.

## Overview

This script is designed to work on a section-by-section basis. You can manage multiple presentation outlines within this single document, with each section linked to its own unique Gamma presentation.

A "section" is defined as a **Heading 1** and all the content that follows it, up to the next **Heading 1**.

## Initial Setup

Before you begin, you need to configure your API Key and add at least one Gamma Template.

### 1. Set Your API Key
1.  Go to the **Send to Gamma** menu and select **Set API Key**.
2.  Paste your API key into the dialog and click "Save". You only need to do this once.

### 2. Add and Manage Templates
1.  Go to the **Send to Gamma** menu and select **Add/Manage Templates**.
2.  Use this dialog to add new templates by providing a name and ID, or to remove existing ones.

#### How to Find Your Gamma Template ID
1.  Open your desired template in Gamma.
2.  The URL will look like: `https://gamma.app/docs/Untitled-g_xxxxxxxxxxxxxx`
3.  The Template ID is the part that starts with `g_`. Copy this ID.

## Structuring Your Content

The script uses paragraph styles to understand your presentation's structure.

*   **Section Title / Deck Title:** Use **Heading 1**. This is crucial as it marks the beginning of a section.
*   **Slide Title:** Use **Heading 2**.
*   **Slide Subtitle:** Use **Subtitle**.
*   **Body Content:** Use **Normal Text**.
*   **Slide Footer:** Use **Heading 4**.
*   **Slide Break:** Insert a **Horizontal Rule** (`Insert > Horizontal line`) to force a new slide.

## Configuring the Generation Prompt (in Footer)

The main instruction for the AI, the "Generation Prompt," is taken directly from the footer of this document.

1.  Open the footer (`Insert > Header & footer > Footer`).
2.  Enter whatever text you want to use as the prompt. The entire content of the footer will be used.
    *   **Note:** If the footer contains a line with the exact text "AI Instructions", the script will ignore it.

## Creating and Updating a Presentation

1.  **Place your cursor** anywhere within the section you want to generate (i.e., under the desired "Heading 1").
2.  Go to the **Send to Gamma** menu and select **Create Presentation**.
3.  A dialog will appear.

### Settings
*   **Select Gamma Template:** Choose your desired template from the dropdown.
*   **Advanced Settings (Optional):** Click the "Advanced Settings" button to configure options like Image Style, Export Format, and Sharing Permissions for this specific generation.

4.  Click **Create Presentation**. The script will use your content, the prompt from the footer, and the settings from the dialog to generate the presentation.

### Link Insertion and Updates
*   **First Time:** The script will generate a **new** presentation and insert two links ("View Presentation" and "Download Link") directly below the "Heading 1" of the current section.
*   **Subsequent Times:** When you run the script again from the same section, it will generate a **new** presentation and **replace the old links** with the new ones. This ensures your document always points to the latest version.
