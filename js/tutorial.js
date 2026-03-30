(function () {
  var TUTORIAL_KEY = 'serviceCallsTutorialSeen';
  var currentStepIndex = 0;
  var activeTarget = null;

  var steps = [
    {
      selector: '.left-column .toolbar-panel',
      text: 'Use these controls to filter request type, change map coloring, toggle city heatmap, and clear selections.'
    },
    {
      selector: '#my-map',
      text: 'The map shows each 311 record as a point. Click any point to inspect full details.'
    },
    {
      selector: '.charts-panel',
      text: 'These views summarize request type, priority, agency, method, and neighborhood. Clicking chart elements filters the whole app.'
    },
    {
      selector: '.timeline-panel',
      text: 'The timeline supports brushing by date range. You can also use Play/Reset controls to animate a moving time window.'
    }
  ];

  function ensureTutorialMarkup() {
    return fetch('tutorial.html')
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var host = document.createElement('div');
        host.id = 'tutorial-host';
        host.innerHTML = html;
        document.body.appendChild(host);
      });
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function clearHighlight() {
    if (activeTarget) {
      activeTarget.classList.remove('tutorial-highlight-target');
      activeTarget = null;
    }
  }

  function applyHighlight(selector) {
    clearHighlight();
    var target = document.querySelector(selector);
    if (!target) return;
    activeTarget = target;
    activeTarget.classList.add('tutorial-highlight-target');
  }

  function renderStep() {
    var textEl = getEl('tutorial-step-text');
    var counterEl = getEl('tutorial-step-counter');
    var prevBtn = getEl('tutorial-prev-btn');
    var nextBtn = getEl('tutorial-next-btn');
    if (!textEl || !counterEl || !prevBtn || !nextBtn) return;

    var step = steps[currentStepIndex];
    textEl.textContent = step.text;
    counterEl.textContent = 'Step ' + (currentStepIndex + 1) + ' of ' + steps.length;
    prevBtn.disabled = currentStepIndex === 0;
    nextBtn.textContent = currentStepIndex === steps.length - 1 ? 'Finish' : 'Next';
    applyHighlight(step.selector);
  }

  function openTutorial(markSeenNow) {
    var overlay = getEl('tutorial-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    if (markSeenNow) localStorage.setItem(TUTORIAL_KEY, 'true');
    renderStep();
  }

  function closeTutorial() {
    var overlay = getEl('tutorial-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    clearHighlight();
    localStorage.setItem(TUTORIAL_KEY, 'true');
  }

  function bindEvents() {
    var helpBtn = getEl('tutorial-help-btn');
    var skipBtn = getEl('tutorial-skip-btn');
    var prevBtn = getEl('tutorial-prev-btn');
    var nextBtn = getEl('tutorial-next-btn');
    var backdrop = document.querySelector('.tutorial-backdrop');

    if (helpBtn) {
      helpBtn.addEventListener('click', function () {
        currentStepIndex = 0;
        openTutorial(false);
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        closeTutorial();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', function () {
        closeTutorial();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentStepIndex > 0) {
          currentStepIndex -= 1;
          renderStep();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentStepIndex < steps.length - 1) {
          currentStepIndex += 1;
          renderStep();
          return;
        }
        closeTutorial();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureTutorialMarkup()
      .then(function () {
        bindEvents();
        if (!localStorage.getItem(TUTORIAL_KEY)) {
          currentStepIndex = 0;
          openTutorial(true);
        }
      })
      .catch(function () {
        // Keep app functional even if tutorial template fails to load.
      });
  });
})();
