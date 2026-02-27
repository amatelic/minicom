import { test, expect } from "@playwright/test";

test.describe("Visitor Widget", () => {
  test("opens the visitor page and allows typing a message", async ({ page }) => {
    // Navigate to the visitor page
    await page.goto("/");

    // Verify the page loads by checking for the chat button
    const chatButton = page.getByRole("button", {
      name: "Open support chat",
    });
    await expect(chatButton).toBeVisible();

    // Click the chat button to open the widget
    await chatButton.click({ force: true });

    // Wait for the widget dialog to be visible
    const widgetDialog = page.getByRole("dialog", {});
    await expect(widgetDialog).toBeVisible();

    // Verify the widget opened by checking for the message input textarea
    const messageInput = page.locator("textarea#visitor-message-input");
    await expect(messageInput).toBeVisible();

    // Type a test message into the input field
    const testMessage = "Hello, this is a test message!";
    await messageInput.fill(testMessage);

    // Verify the message was typed into the input
    await expect(messageInput).toHaveValue(testMessage);
  });

  test("keeps secondary tab read-only for the same visitor account", async ({ browser }) => {
    const context = await browser.newContext();
    const primaryPage = await context.newPage();
    const secondaryPage = await context.newPage();

    await primaryPage.goto("/");
    await secondaryPage.goto("/");

    await primaryPage.getByRole("button", { name: "Open support chat" }).click({ force: true });
    await secondaryPage.getByRole("button", { name: "Open support chat" }).click({ force: true });

    const primaryInput = primaryPage.locator("textarea#visitor-message-input");
    const secondaryInput = secondaryPage.locator("textarea#visitor-message-input");

    await expect(primaryInput).toBeEnabled();
    await expect(secondaryInput).toBeDisabled();
    await expect(
      secondaryPage.getByText("This chat is active in another tab. This tab is read-only."),
    ).toHaveCount(1);

    await context.close();
  });
});
