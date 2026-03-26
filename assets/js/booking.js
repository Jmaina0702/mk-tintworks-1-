const WEB3_ENDPOINT = "https://api.web3forms.com/submit";
const WEB3_ACCESS_KEY = "ff17132d-427d-43fa-83a3-56c9c0442707";

const sanitize = (value) => {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .substring(0, 1000);
};

const validatePhone = (value) => /^(?:\+?254|0)?7\d{8}$/.test(value.replace(/[\s()-]/g, ""));
const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const getErrorNode = (form, field) => form.querySelector(`[data-error-for="${field}"]`);
const getStatusNode = (form) => form.querySelector("[data-form-status]");

const showError = (form, field, message) => {
  const node = getErrorNode(form, field);
  if (node) node.textContent = message;
};

const clearErrors = (form) => {
  form.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });
};

const setStatus = (form, type, message) => {
  const node = getStatusNode(form);
  if (!node) return;
  node.textContent = message;
  node.className = `form-status is-visible is-${type}`;
};

const clearStatus = (form) => {
  const node = getStatusNode(form);
  if (!node) return;
  node.textContent = "";
  node.className = "form-status";
};

const openWhatsApp = (message) => {
  const anchor = document.createElement("a");
  anchor.href = `https://wa.me/254703900575?text=${message}`;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.className = "visually-hidden";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
};

const sendForm = async (payload) => {
  const response = await fetch(WEB3_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  return response.ok && result.success;
};

const bookingForm = document.getElementById("booking-form");
if (bookingForm) {
  const dateInput = bookingForm.querySelector("#date");
  if (dateInput) {
    dateInput.min = new Date().toISOString().split("T")[0];
  }

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(bookingForm);
    clearStatus(bookingForm);

    if (bookingForm.querySelector("#website")?.value) return;

    const data = {
      firstName: sanitize(bookingForm.querySelector("#first-name")?.value ?? ""),
      lastName: sanitize(bookingForm.querySelector("#last-name")?.value ?? ""),
      phone: sanitize(bookingForm.querySelector("#phone")?.value ?? ""),
      email: sanitize(bookingForm.querySelector("#email")?.value ?? ""),
      date: sanitize(bookingForm.querySelector("#date")?.value ?? ""),
      service: sanitize(bookingForm.querySelector("#service")?.value ?? ""),
      message: sanitize(bookingForm.querySelector("#message")?.value ?? ""),
    };

    let valid = true;
    if (!data.firstName) {
      showError(bookingForm, "first-name", "First name is required.");
      valid = false;
    }
    if (!data.lastName) {
      showError(bookingForm, "last-name", "Last name is required.");
      valid = false;
    }
    if (!validatePhone(data.phone)) {
      showError(bookingForm, "phone", "Enter a valid Kenyan phone number.");
      valid = false;
    }
    if (!validateEmail(data.email)) {
      showError(bookingForm, "email", "Enter a valid email address.");
      valid = false;
    }
    if (!data.date) {
      showError(bookingForm, "date", "Please select your preferred date.");
      valid = false;
    }
    if (!data.service) {
      showError(bookingForm, "service", "Please choose a service.");
      valid = false;
    }

    if (!valid) {
      setStatus(bookingForm, "error", "Please correct the highlighted fields and try again.");
      return;
    }

    const submitButton = bookingForm.querySelector('[type="submit"]');
    submitButton?.setAttribute("disabled", "true");
    if (submitButton) submitButton.textContent = "Sending...";

    const waMessage = encodeURIComponent(
      [
        "New Booking Request – MK Tintworks",
        `Name: ${data.firstName} ${data.lastName}`,
        `Phone: ${data.phone}`,
        `Email: ${data.email}`,
        `Service: ${data.service}`,
        `Preferred Date: ${data.date}`,
        `Message: ${data.message || "N/A"}`,
      ].join("\n")
    );

    const emailOk = await sendForm({
      access_key: WEB3_ACCESS_KEY,
      subject: "New Booking – MK Tintworks",
      from_name: `${data.firstName} ${data.lastName}`,
      email: data.email,
      phone: data.phone,
      preferred_date: data.date,
      service: data.service,
      message: data.message || "N/A",
    }).catch(() => false);

    openWhatsApp(waMessage);

    if (emailOk) {
      setStatus(bookingForm, "success", "Your booking request has been sent. WhatsApp should open next so you can complete the message.");
      bookingForm.reset();
      if (dateInput) dateInput.min = new Date().toISOString().split("T")[0];
    } else {
      setStatus(bookingForm, "error", "Email delivery failed. WhatsApp was opened with your booking details, so you can still send the request manually.");
    }

    submitButton?.removeAttribute("disabled");
    if (submitButton) submitButton.textContent = "Book Now";
  });
}
