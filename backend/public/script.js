// === Image preview and multi-file handling ===
const imageInput = document.querySelector("#image-input");
const previewContainer = document.querySelector("#preview-container");

window.allFiles = []; // global file list

function renderPreviews() {
  previewContainer.innerHTML = "";

  if (window.allFiles.length === 0) {
    previewContainer.classList.add("hidden");
    return;
  }

  previewContainer.classList.remove("hidden");

  window.allFiles.forEach((file, index) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";

      const img = document.createElement("img");
      img.src = e.target.result;
      img.classList.add("preview-image");

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      Object.assign(removeBtn.style, {
        position: "absolute",
        top: "5px",
        right: "5px",
        background: "rgba(0,0,0,0.6)",
        color: "white",
        border: "none",
        borderRadius: "50%",
        width: "24px",
        height: "24px",
        cursor: "pointer",
      });
      removeBtn.title = "Remove image";

      removeBtn.addEventListener("click", () => {
        window.allFiles.splice(index, 1);
        renderPreviews();
      });

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      previewContainer.appendChild(wrapper);
    };
    reader.readAsDataURL(file);
  });
}

imageInput.addEventListener("change", () => {
  const newFiles = Array.from(imageInput.files);
  window.allFiles = window.allFiles.concat(newFiles);
  renderPreviews();

  // Reset file input so user can re-upload same file if needed
  imageInput.value = "";
});


// === Recipe generation and image recognition ===

function displayRecipe(response) {
  console.log("recipe generated");
  const recipeText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  // Remove code block markers if present
  if (recipeText.startsWith("```")) {
    recipeText = recipeText.replace(/^```[a-z]*\n/, "").replace(/```$/, "");
  }
  
  new Typewriter("#recipe", {
    strings: recipeText || "⚠️ No recipe found.",
    autoStart: true,
    delay: 10,
    cursor: "",
  });
}

function recognizeIngredientsFromImage(files) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("images", file);
  });

  return axios
    .post("https://dishdash-m977.onrender.com/recognize-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((response) => response.data.labels);
}

function isFoodLabels(labels) {
  const prompt = `These are labels detected from an image: ${labels.join(", ")}. Are these related to food items? Respond only with true or false.`;

  return axios
    .post("https://dishdash-m977.onrender.com/check-if-food", { prompt })
    .then((response) => {
      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
      return text === "true";
    });
}

function generateRecipe(event) {
  event.preventDefault();

  const instructions = document.querySelector("#user-instructions").value.trim();
  const recipeElement = document.querySelector("#recipe");

  recipeElement.classList.remove("hidden");
  recipeElement.innerHTML = `<div class="blink">👩🏽‍🍳 Generating recipe...</div>`;

  const hasText = instructions.length > 0;
  const hasImage = window.allFiles.length > 0;

  if (!hasText && !hasImage) {
    recipeElement.innerHTML = "❗ Please enter text or upload an image.";
    return;
  }

  if (hasImage) {
    recognizeIngredientsFromImage(window.allFiles)
  .then((labels) => {
    console.log("Recognized labels:", labels);
    return isFoodLabels(labels).then((isFood) => {
      if (!isFood) {
        recipeElement.innerHTML = "🚫 This image does not appear to contain food.";
        throw new Error("Non-food image detected.");
      }

      const extractedIngredients = labels.join(", ");
      const prompt = `Generate a recipe with these ingredients: ${extractedIngredients}`;
      const context = `You are an expert chef and HTML writer. Return the recipe in raw HTML only — without using code blocks like \`\`\`html and dont use '&' to say and. 
        Do not use & or &amp; , write out the word "and" instead. 
        Start with the recipe title as a heading. Then provide a list of ingredients and step-by-step instructions.
        Keep the instruction clear, simple and begineer friendly. Also include some nutritions fact. 
        Use cups, grams (g), tbsp, tsp, etc. Avoid lbs or oz. End with: <strong>Bon Appetit! Enjoy your meals!</strong>`;

      return axios.post("https://dishdash-m977.onrender.com/generate-recipe", { prompt, context });
    });
  })
  .then(displayRecipe)
  .catch((error) => {
    console.error("Image-based recipe generation failed:", error);
    if (!error.message.includes("Non-food")) {
      recipeElement.innerHTML = "❌ Failed to process image. Try again.";
    }
  });

  } else if (hasText) {
    const prompt = `User instructions are: Generate a recipe with these ingredients ${instructions}`;
    const context = `You are an expert chef and HTML writer. Return the recipe in raw HTML only — without using code blocks like \`\`\`html and dont use '&' to say and.
    Do not use & or &amp; , write out the word "and" instead. 
      Start with the recipe title as a heading. Then provide a list of ingredients and step-by-step instructions.
      Keep the instruction clear, simple and begineer friendly. Also include some nutritions fact. 
      Use cups, grams (g), tbsp, tsp, etc. Avoid lbs or oz. End with: <strong>Bon Appetit! Enjoy your meals!</strong>`;

    axios
      .post("https://dishdash-m977.onrender.com/generate-recipe", { prompt, context })
      .then(displayRecipe)
      .catch((error) => {
        console.error("Text-based recipe generation failed:", error);
        recipeElement.innerHTML = "❌ Something went wrong. Please try again.";
      });
  }
}

const recipeForm = document.querySelector("#recipe-generator-form");
recipeForm.addEventListener("submit", generateRecipe);
