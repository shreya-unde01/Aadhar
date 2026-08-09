(function () {
  const container = document.getElementById('items-container');
  const addBtn = document.getElementById('add-item');
  const form = document.getElementById('bulk-form');
  const itemsJsonInput = document.getElementById('itemsJson');

  let rowCount = 0;

  function addRow() {
    rowCount += 1;
    const id = `item-${rowCount}`;
    const row = document.createElement('div');
    row.className = 'bulk-item';
    row.dataset.rowId = id;
    row.innerHTML = `
      <button type="button" class="bulk-item-remove" aria-label="Remove item">✕ Remove</button>
      <div class="field-row">
        <div class="field">
          <label>Quantity</label>
          <input type="number" min="0.01" step="0.01" class="item-quantity" placeholder="e.g. 50">
        </div>
        <div class="field">
          <label>Unit <span class="muted">(optional)</span></label>
          <input type="text" class="item-unit" placeholder="kg, plates, items…">
        </div>
      </div>
      <div class="field">
        <label>Description <span class="muted">(optional)</span></label>
        <input type="text" class="item-description" placeholder="Anything worth noting">
      </div>
      <div class="field item-expiry-field">
        <label>Expiry Date <span class="muted">(food only)</span></label>
        <input type="date" class="item-expiry">
      </div>
      <label class="checkbox-field">
        <input type="checkbox" class="item-urgent">
        Mark as urgent
      </label>
    `;
    container.appendChild(row);

    row.querySelector('.bulk-item-remove').addEventListener('click', () => row.remove());
  }

  addBtn.addEventListener('click', addRow);
  addRow(); // start with one row so the form isn't empty

  form.addEventListener('submit', (e) => {
    const rows = Array.from(container.querySelectorAll('.bulk-item'));
    const items = rows.map((row) => ({
      type: 'food',
      quantity: row.querySelector('.item-quantity').value,
      unit: row.querySelector('.item-unit').value,
      description: row.querySelector('.item-description').value,
      expiryDate: row.querySelector('.item-expiry').value,
      urgent: row.querySelector('.item-urgent').checked,
    }));

    if (items.length === 0 || items.some((i) => !i.quantity)) {
      e.preventDefault();
      alert('Please enter a quantity for every food item.');
      return;
    }

    itemsJsonInput.value = JSON.stringify(items);
  });
})();
