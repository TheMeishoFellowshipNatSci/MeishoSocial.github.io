(() => {
  'use strict';

  const ELEMENT_PRIMES = Object.freeze({
    '炎': 419,
    '水': 613,
    '風': 739,
    '雷': 941,
    '草': 113,
    '氷': 197,
    '岩': 823
  });

  function normalizeMemberHex(value) {
    const normalized = String(value || '')
      .trim()
      .replace(/^0x/i, '')
      .replace(/[\s-]/g, '')
      .toUpperCase();

    return /^[0-9A-F]+$/.test(normalized)
      ? normalized
      : '';
  }

  function hexModulo(hexValue, divisor) {
    let remainder = 0;

    for (let index = 0; index < hexValue.length; index += 1) {
      const digit = Number.parseInt(hexValue.charAt(index), 16);

      if (Number.isNaN(digit)) return Number.NaN;

      remainder = (remainder * 16 + digit) % divisor;
    }

    return remainder;
  }

  function detectElement(memberNumber) {
    const hexValue = normalizeMemberHex(memberNumber);

    if (!hexValue || hexModulo(hexValue, 257) !== 0) {
      return null;
    }

    const matches = Object.entries(ELEMENT_PRIMES)
      .filter(([, prime]) =>
        hexModulo(hexValue, 257 * prime) === 0
      )
      .map(([element]) => element);

    return matches.length === 1 ? matches[0] : null;
  }

  function createElementField(selectId, noteText) {
    const label = document.createElement('label');
    label.className = 'field dion-element-field';
    label.innerHTML = `
      元素
      <select id="${selectId}" required>
        <option value="">元素を選択</option>
        <option value="炎">炎</option>
        <option value="水">水</option>
        <option value="風">風</option>
        <option value="雷">雷</option>
        <option value="草">草</option>
        <option value="氷">氷</option>
        <option value="岩">岩</option>
      </select>
      <small>${noteText}</small>
    `;
    return label;
  }

  function installField(formId, numberInputId, selectId) {
    const form = document.getElementById(formId);
    const numberInput = document.getElementById(numberInputId);

    if (!form || !numberInput || document.getElementById(selectId)) {
      return;
    }

    const numberField = numberInput.closest('label');
    const elementField = createElementField(
      selectId,
      '会員番号に含まれる元素情報と照合します。'
    );

    if (numberField) {
      numberField.parentNode.insertBefore(elementField, numberField);
    } else {
      form.insertBefore(elementField, form.firstChild);
    }
  }

  function validateForm(formId, numberInputId, selectId) {
    const form = document.getElementById(formId);
    const numberInput = document.getElementById(numberInputId);
    const select = document.getElementById(selectId);

    if (!form || !numberInput || !select) return;

    form.addEventListener('submit', (event) => {
      const selected = select.value;
      const detected = detectElement(numberInput.value);

      let message = '';

      if (!selected) {
        message = '元素を選択してください。';
      } else if (!detected) {
        message = '会員番号を確認できませんでした。';
      } else if (selected !== detected) {
        message = `選択した元素「${selected}」と、会員番号から判定された元素「${detected}」が一致しません。`;
      }

      if (!message) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      select.setCustomValidity(message);
      select.reportValidity();
      window.setTimeout(() => select.setCustomValidity(''), 100);
    }, true);

    select.addEventListener('change', () => {
      select.setCustomValidity('');
    });

    numberInput.addEventListener('input', () => {
      select.setCustomValidity('');
    });
  }

  function addStyles() {
    if (document.getElementById('dionElementStyles')) return;

    const style = document.createElement('style');
    style.id = 'dionElementStyles';
    style.textContent = `
      .dion-element-field select {
        width: 100%;
        height: 42px;
        padding: 0 10px;
        border: 1px solid var(--line, #e6e6e8);
        border-radius: 3px;
        background: var(--panel2, #f7f7f8);
        color: var(--text, #333);
        font: inherit;
      }
      .dion-element-field small {
        color: var(--muted, #8a8a8f);
        font-size: 11px;
        font-weight: 400;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  function initialize() {
    addStyles();
    installField('loginForm', 'loginNumber', 'loginElement');
    installField('registerForm', 'regNumber', 'regElement');
    validateForm('loginForm', 'loginNumber', 'loginElement');
    validateForm('registerForm', 'regNumber', 'regElement');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
