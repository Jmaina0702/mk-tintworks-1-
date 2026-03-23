const body = document.body;

const themeToggle = document.querySelector('.theme-toggle');
const themeLabel = document.querySelector('.theme-toggle-label');

const applyTheme = (theme) => {
  body.classList.toggle('light', theme === 'light');
  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
  }
  if (themeLabel) {
    themeLabel.textContent = theme === 'light' ? 'Light' : 'Dark';
  }
};

const storedTheme = localStorage.getItem('theme');
const prefersLight =
  window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
const initialTheme = storedTheme || (prefersLight ? 'light' : 'dark');
applyTheme(initialTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const nextTheme = body.classList.contains('light') ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  });
}

const navToggle = document.querySelector('.nav-toggle');
const navBackdrop = document.querySelector('.nav-backdrop');
const navLinks = document.querySelectorAll('.nav-link');

const closeNav = () => {
  body.classList.remove('nav-open');
  if (navToggle) {
    navToggle.setAttribute('aria-expanded', 'false');
  }
};

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

if (navBackdrop) {
  navBackdrop.addEventListener('click', closeNav);
}

navLinks.forEach((link) => {
  link.addEventListener('click', closeNav);
});

const sections = document.querySelectorAll('section[data-section]');
const setActiveLink = (id) => {
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
  });
};

if (sections.length) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveLink(entry.target.id);
        }
      });
    },
    {
      rootMargin: '-40% 0px -50% 0px',
      threshold: 0.1,
    }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('[data-brand-panel]');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const brand = tab.dataset.brand;
    tabs.forEach((btn) => btn.classList.toggle('active', btn === tab));
    panels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.brandPanel === brand);
    });
  });
});

const revealItems = document.querySelectorAll('[data-reveal]');
if (revealItems.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    },
    { threshold: 0.15 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}

const deferredBackgrounds = document.querySelectorAll('.deferred-bg');
if (deferredBackgrounds.length) {
  const bgObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-bg-ready');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      // Start loading slightly before the section reaches the viewport.
      rootMargin: '280px 0px',
      threshold: 0.01,
    }
  );

  deferredBackgrounds.forEach((section) => bgObserver.observe(section));
}

const form = document.getElementById('booking-form');
if (form) {
  const fields = {
    firstName: form.querySelector('#first-name'),
    lastName: form.querySelector('#last-name'),
    phone: form.querySelector('#phone'),
    email: form.querySelector('#email'),
    date: form.querySelector('#date'),
    service: form.querySelector('#service'),
  };

  const errors = {
    firstName: form.querySelector('[data-error-for="first-name"]'),
    lastName: form.querySelector('[data-error-for="last-name"]'),
    phone: form.querySelector('[data-error-for="phone"]'),
    email: form.querySelector('[data-error-for="email"]'),
    date: form.querySelector('[data-error-for="date"]'),
    service: form.querySelector('[data-error-for="service"]'),
  };

  const status = document.getElementById('form-status');
  const waStatus = document.getElementById('wa-status');
  const emailStatus = document.getElementById('email-status');
  const waFallback = document.getElementById('wa-fallback');
  const waMessage = document.getElementById('wa-message');
  const copyButton = document.getElementById('copy-wa');
  const honeypot = document.getElementById('website');

  const setStatus = (el, message, type = '') => {
    if (!el) return;
    el.textContent = message;
    el.className = `form-status ${type}`.trim();
  };

  const setError = (field, message) => {
    if (errors[field]) {
      errors[field].textContent = message;
    }
  };

  const clearError = (field) => {
    if (errors[field]) {
      errors[field].textContent = '';
    }
  };

  const normalizePhone = (value) => value.replace(/[\s()-]/g, '');

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validatePhone = (value) => /^(?:\+?254|0)?7\d{8}$/.test(value);

  const buildMessage = () => {
    const messageValue = form.querySelector('#message').value.trim();
    return [
      'New Booking Request – MK Tintworks',
      `Name: ${fields.firstName.value.trim()} ${fields.lastName.value.trim()}`,
      `Phone: ${normalizePhone(fields.phone.value.trim())}`,
      `Email: ${fields.email.value.trim()}`,
      `Service: ${fields.service.value}`,
      `Preferred Date: ${fields.date.value}`,
      'Message:',
      messageValue || 'N/A',
    ].join('\n');
  };

  Object.keys(fields).forEach((key) => {
    fields[key].addEventListener('input', () => clearError(key));
  });

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      if (!waMessage) return;
      try {
        await navigator.clipboard.writeText(waMessage.value);
        setStatus(waStatus, 'Message copied to clipboard.', 'success');
      } catch (err) {
        setStatus(waStatus, 'Unable to copy message. Please copy manually.', 'error');
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(status, '');
    setStatus(waStatus, '');
    setStatus(emailStatus, '');

    if (honeypot && honeypot.value) {
      return;
    }

    let isValid = true;

    if (!fields.firstName.value.trim()) {
      setError('firstName', 'Please enter your first name.');
      isValid = false;
    }

    if (!fields.lastName.value.trim()) {
      setError('lastName', 'Please enter your last name.');
      isValid = false;
    }

    const phoneValue = normalizePhone(fields.phone.value.trim());
    if (!validatePhone(phoneValue)) {
      setError('phone', 'Enter a valid Kenyan phone number (e.g., +2547XXXXXXXX).');
      isValid = false;
    }

    if (!validateEmail(fields.email.value.trim())) {
      setError('email', 'Enter a valid email address.');
      isValid = false;
    }

    if (!fields.date.value) {
      setError('date', 'Please select your preferred date.');
      isValid = false;
    }

    if (!fields.service.value) {
      setError('service', 'Please select a service.');
      isValid = false;
    }

    if (!isValid) {
      setStatus(status, 'Please correct the highlighted fields.', 'error');
      return;
    }

    const message = buildMessage();
    const waUrl = `https://wa.me/254703900575?text=${encodeURIComponent(message)}`;
    const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
    const waOpened = !!waWindow;

    if (waMessage) {
      waMessage.value = message;
    }

    if (waOpened) {
      setStatus(waStatus, 'WhatsApp opened. Please tap Send to complete your booking.', 'success');
      if (waFallback) waFallback.hidden = true;
    } else {
      setStatus(waStatus, 'WhatsApp could not be opened automatically.', 'error');
      if (waFallback) waFallback.hidden = false;
    }

    const accessKey = form.querySelector('[name="access_key"]').value.trim();
    let emailOk = false;

    if (!accessKey || accessKey === 'YOUR_ACCESS_KEY_HERE') {
      setStatus(emailStatus, 'Email delivery is not configured. Add your Web3Forms access key.', 'error');
    } else {
      try {
        const payload = {
          access_key: accessKey,
          subject: 'New Booking – MK Tintworks',
          first_name: fields.firstName.value.trim(),
          last_name: fields.lastName.value.trim(),
          phone: phoneValue,
          email: fields.email.value.trim(),
          service: fields.service.value,
          preferred_date: fields.date.value,
          message: form.querySelector('#message').value.trim(),
        };

        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          emailOk = true;
          setStatus(emailStatus, 'Email sent successfully.', 'success');
        } else {
          setStatus(emailStatus, 'Email sending failed. Please try again.', 'error');
        }
      } catch (error) {
        setStatus(emailStatus, 'Email sending failed. Please try again.', 'error');
      }
    }

    if (waOpened && emailOk) {
      setStatus(status, 'Your booking request has been sent successfully.', 'success');
      form.reset();
    } else {
      setStatus(status, 'We could not complete the booking request. Please review the messages above.', 'error');
    }
  });
}
