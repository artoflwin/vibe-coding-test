// Ledgerly stores all transactions in the browser, so no account or server is needed.
const STORAGE_KEY = 'ledgerly-transactions';
let transactions = loadTransactions();

const form = document.querySelector('#transaction-form');
const typeInput = document.querySelector('#transaction-type');
const descriptionInput = document.querySelector('#transaction-description');
const amountInput = document.querySelector('#transaction-amount');
const dateInput = document.querySelector('#transaction-date');
const editingIdInput = document.querySelector('#editing-id');
const formError = document.querySelector('#form-error');
const saveButton = document.querySelector('#save-button');
const cancelEditButton = document.querySelector('#cancel-edit');
const transactionList = document.querySelector('#transaction-list');
const emptyState = document.querySelector('#empty-state');
const chartEmpty = document.querySelector('#chart-empty');
const chart = document.querySelector('#cash-flow-chart');

dateInput.value = todayAsInputValue();
form.addEventListener('submit', saveTransaction);
cancelEditButton.addEventListener('click', resetForm);
document.querySelector('#add-transaction-button').addEventListener('click', () => {
  document.querySelector('#transaction-type').focus();
  document.querySelector('.quick-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
window.addEventListener('resize', drawChart);

render();

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function todayAsInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split('T')[0];
}

function saveTransaction(event) {
  event.preventDefault();
  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const date = dateInput.value;

  if (!description) return showError('Please enter a description.');
  if (!Number.isFinite(amount) || amount <= 0) return showError('Please enter an amount greater than $0.');
  if (amount > 999999999) return showError('Please enter an amount below $999,999,999.');
  if (!date) return showError('Please choose a date.');

  const editingId = editingIdInput.value;
  const record = { id: editingId || String(Date.now()), type: typeInput.value, description, amount: Math.round(amount * 100) / 100, date };
  if (editingId) {
    transactions = transactions.map(transaction => transaction.id === editingId ? record : transaction);
  } else {
    transactions.push(record);
  }
  saveToStorage();
  render();
  resetForm();
}

function showError(message) {
  formError.textContent = message;
  formError.focus();
}

function render() {
  const income = transactions.filter(item => item.type === 'income').reduce((total, item) => total + item.amount, 0);
  const expenses = transactions.filter(item => item.type === 'expense').reduce((total, item) => total + item.amount, 0);
  document.querySelector('#total-income').textContent = formatMoney(income);
  document.querySelector('#total-expenses').textContent = formatMoney(expenses);
  document.querySelector('#net-profit').textContent = formatMoney(income - expenses);
  document.querySelector('#transaction-count').textContent = `${transactions.length} ${transactions.length === 1 ? 'record' : 'records'}`;

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
  transactionList.innerHTML = sorted.map(transaction => `
    <tr>
      <td class="description-cell">${escapeHtml(transaction.description)}</td>
      <td><span class="type-pill type-${transaction.type}">${capitalize(transaction.type)}</span></td>
      <td>${formatDate(transaction.date)}</td>
      <td class="amount-${transaction.type}">${transaction.type === 'income' ? '+' : '-'}${formatMoney(transaction.amount)}</td>
      <td><button class="action-button" data-action="edit" data-id="${transaction.id}" type="button">Edit</button><button class="action-button delete-button" data-action="delete" data-id="${transaction.id}" type="button">Delete</button></td>
    </tr>`).join('');
  emptyState.hidden = transactions.length > 0;
  transactionList.hidden = transactions.length === 0;
  transactionList.querySelectorAll('button').forEach(button => button.addEventListener('click', handleAction));
  drawChart();
}

function handleAction(event) {
  const id = event.currentTarget.dataset.id;
  const transaction = transactions.find(item => item.id === id);
  if (!transaction) return;
  if (event.currentTarget.dataset.action === 'delete') {
    if (!window.confirm(`Delete the transaction “${transaction.description}”?`)) return;
    transactions = transactions.filter(item => item.id !== id);
    saveToStorage();
    render();
  } else {
    typeInput.value = transaction.type;
    descriptionInput.value = transaction.description;
    amountInput.value = transaction.amount;
    dateInput.value = transaction.date;
    editingIdInput.value = transaction.id;
    saveButton.textContent = 'Update transaction';
    cancelEditButton.classList.remove('hidden');
    formError.textContent = '';
    document.querySelector('.quick-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    descriptionInput.focus();
  }
}

function resetForm() {
  form.reset();
  editingIdInput.value = '';
  dateInput.value = todayAsInputValue();
  saveButton.textContent = 'Save transaction';
  cancelEditButton.classList.add('hidden');
  formError.textContent = '';
}

function drawChart() {
  const context = chart.getContext('2d');
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  const scale = window.devicePixelRatio || 1;
  chart.width = width * scale;
  chart.height = height * scale;
  context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  const income = transactions.filter(item => item.type === 'income').reduce((total, item) => total + item.amount, 0);
  const expenses = transactions.filter(item => item.type === 'expense').reduce((total, item) => total + item.amount, 0);
  const max = Math.max(income, expenses, 1);
  const bottom = height - 35;
  const barWidth = Math.min(82, width / 5);
  const bars = [{ label: 'Income', value: income, color: '#1ba58c', x: width * .33 }, { label: 'Expenses', value: expenses, color: '#e4646d', x: width * .67 }];
  context.font = '11px DM Sans, sans-serif';
  context.textAlign = 'center';
  bars.forEach(bar => {
    const barHeight = Math.max(bar.value ? (bar.value / max) * (bottom - 25) : 2, 2);
    context.fillStyle = bar.color;
    context.beginPath();
    context.roundRect(bar.x - barWidth / 2, bottom - barHeight, barWidth, barHeight, 6);
    context.fill();
    context.fillStyle = '#68798a';
    context.fillText(bar.label, bar.x, height - 10);
    if (bar.value) { context.fillStyle = '#172b45'; context.font = '600 11px DM Sans, sans-serif'; context.fillText(formatMoney(bar.value), bar.x, bottom - barHeight - 9); context.font = '11px DM Sans, sans-serif'; }
  });
  chartEmpty.hidden = transactions.length > 0;
}

function formatMoney(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value); }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeHtml(value) { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
