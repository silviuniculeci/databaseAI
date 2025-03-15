document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('prompt-input');
  const submitBtn = document.getElementById('submit-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const emptyState = document.getElementById('empty-state');
  const resultsSummary = document.getElementById('results-summary');
  const resultsTable = document.getElementById('results-table');
  const resultsCards = document.getElementById('results-cards');

  // Handle suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.textContent;
      handleQuery(chip.textContent);
    });
  });

  // Handle submit button
  submitBtn.addEventListener('click', () => {
    const query = promptInput.value.trim();
    if (query) {
      handleQuery(query);
    }
  });

  // Handle enter key
  promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = promptInput.value.trim();
      if (query) {
        handleQuery(query);
      }
    }
  });

  // Handle view switching
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      
      // Show corresponding view
      const viewType = btn.getAttribute('data-view');
      showView(viewType, currentData);
    });
  });

  let currentData = null;

  async function handleQuery(query) {
    try {
      loadingIndicator.style.display = 'flex';
      emptyState.style.display = 'none';
      resultsSummary.classList.add('hidden');

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: query })
      });

      const result = await response.json();
      console.log('Query result:', result);

      if (!result.success) {
        throw new Error(result.error);
      }

      currentData = result.data;
      
      showResults(result, query);

    } catch (error) {
      console.error('Error:', error);
      alert('Error processing query: ' + error.message);
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  function showResults(result, query) {
    resultsSummary.classList.remove('hidden');
    
    let displayData = [];
    let title = '';
    let insights = [];

    // Process the data based on the query
    if (query.toLowerCase().includes('active contracts')) {
        displayData = result.data.contracts
            .filter(c => c.status === 'active')
            .map(contract => {
                const client = result.data.clients.find(c => c.id === contract.client_id);
                return {
                    'Contract Name': contract.contract_name,
                    'Client': client ? client.company_name : '-',
                    'Value': `$${contract.value.toLocaleString()}`,
                    'Start Date': new Date(contract.start_date).toLocaleDateString(),
                    'End Date': new Date(contract.end_date).toLocaleDateString(),
                    'Status': contract.status.toUpperCase()
                };
            });
        title = 'Active Contracts';
        
        // Generate insights
        const totalValue = displayData.reduce((sum, contract) => 
            sum + parseInt(contract.Value.replace(/[$,]/g, '')), 0);
        const avgValue = totalValue / displayData.length;
        const expiringContracts = displayData.filter(contract => 
            new Date(contract['End Date']) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        );

        insights = [
            `Total active contracts value: $${totalValue.toLocaleString()}`,
            `Average contract value: $${Math.round(avgValue).toLocaleString()}`,
            `${expiringContracts.length} contracts expiring in the next 90 days`,
        ];
    } else if (query.toLowerCase().includes('technology')) {
        displayData = result.data.clients
            .filter(c => c.industry === 'Technology')
            .map(client => ({
                'Company': client.company_name,
                'Contact': client.contact_person,
                'Email': client.email,
                'Phone': client.phone,
                'Industry': client.industry
            }));
        title = 'Technology Industry Clients';
    } else if (query.toLowerCase().includes('pending offers')) {
        displayData = result.data.offers
            .filter(o => o.status === 'pending')
            .map(offer => {
                const client = result.data.clients.find(c => c.id === offer.client_id);
                return {
                    'Offer Name': offer.offer_name,
                    'Client': client ? client.company_name : '-',
                    'Description': offer.description,
                    'Value': `$${offer.value.toLocaleString()}`,
                    'Valid Until': new Date(offer.valid_until).toLocaleDateString(),
                    'Status': offer.status.toUpperCase()
                };
            });
        title = 'Pending Offers';
    }

    const summaryHTML = `
        <div class="summary-container">
            <div class="summary-header">
                <h3 class="summary-title">${title}</h3>
                <p>Found ${displayData.length} results</p>
            </div>
            
            ${generateMetricsDisplay(displayData, query)}
            
            <div class="data-display">
                ${formatDataToTable(displayData)}
            </div>
            
            ${generateInsights(insights)}
        </div>
    `;
    
    resultsSummary.innerHTML = summaryHTML;
  }

  function generateMetricsDisplay(data, query) {
    if (query.toLowerCase().includes('active contracts')) {
        const totalValue = data.reduce((sum, contract) => 
            sum + parseInt(contract.Value.replace(/[$,]/g, '')), 0);
        const avgValue = totalValue / data.length;
        const expiringCount = data.filter(contract => 
            new Date(contract['End Date']) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        ).length;

        return `
            <div class="metrics-container">
                <div class="metric">
                    <div class="metric-label">Total Contract Value</div>
                    <div class="metric-value">$${totalValue.toLocaleString()}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Average Value</div>
                    <div class="metric-value">$${Math.round(avgValue).toLocaleString()}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Expiring Soon</div>
                    <div class="metric-value">${expiringCount}</div>
                    <div class="metric-subtitle">in next 90 days</div>
                </div>
            </div>
        `;
    }
    return '';
  }

  function generateInsights(insights) {
    if (!insights || insights.length === 0) return '';
    
    return `
        <div class="insights-section">
            <h4 class="insights-title">Key Insights</h4>
            <div class="insights-list">
                ${insights.map(insight => `
                    <div class="insight-item">
                        <div class="insight-icon">📊</div>
                        <div class="insight-text">${insight}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
  }

  function formatDataToTable(data) {
    if (!data || data.length === 0) {
        return '<p>No results found</p>';
    }

    const headers = Object.keys(data[0]);
    
    return `
        <table class="data-table">
            <thead>
                <tr>
                    ${headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>
                        ${headers.map(header => `
                            <td>${row[header]}</td>
                        `).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  }

  function formatData(data) {
    if (!Array.isArray(data)) {
      return '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            ${Object.keys(data[0] || {}).map(key => `
              <th>${key}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              ${Object.values(item).map(value => `
                <td>${JSON.stringify(value)}</td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function showView(viewType, data) {
    // Hide all views
    resultsSummary.classList.add('hidden');
    if (resultsTable) resultsTable.classList.add('hidden');
    if (resultsCards) resultsCards.classList.add('hidden');

    if (!data) return;

    switch (viewType) {
      case 'summary':
        showSummaryView(data);
        break;
      case 'table':
        showTableView(data);
        break;
      case 'cards':
        showCardView(data);
        break;
    }
  }

  function showSummaryView(data) {
    resultsSummary.classList.remove('hidden');
    
    // Calculate summary metrics
    const totalContracts = data.contracts ? data.contracts.length : 0;
    const activeContracts = data.contracts ? data.contracts.filter(c => c.status === 'active').length : 0;
    const totalValue = data.contracts ? data.contracts.reduce((sum, contract) => sum + contract.value, 0) : 0;
    const avgContractLength = data.contracts ? calculateAverageContractLength(data.contracts) : 0;

    // Update metrics in the UI
    resultsSummary.innerHTML = `
      <div class="summary-container">
        <div class="summary-header">
          <h3 class="summary-title">Business Overview</h3>
          <div class="summary-subtitle">Summary of contracts and offers</div>
        </div>
        
        <div class="summary-metrics">
          <div class="metric-card">
            <div class="metric-label">Active Contracts</div>
            <div class="metric-value">${activeContracts}</div>
            <div class="metric-trend trend-up">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
              ${Math.round((activeContracts/totalContracts) * 100)}% active rate
            </div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">Total Contract Value</div>
            <div class="metric-value">$${formatNumber(totalValue)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function showTableView(data) {
    if (!resultsTable) return;
    resultsTable.classList.remove('hidden');
    
    // Create table HTML based on data structure
    // This will depend on your data structure
  }

  function showCardView(data) {
    if (!resultsCards) return;
    resultsCards.classList.remove('hidden');
    
    // Create cards HTML based on data structure
    // This will depend on your data structure
  }

  function updateInsights(analysis) {
    const insightsContainer = document.querySelector('.insights-container');
    if (!insightsContainer) return;

    // Parse analysis and create insight items
    const insights = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
    
    const insightsList = insights.map(insight => `
      <div class="insight-item">
        <div class="insight-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div>${insight}</div>
      </div>
    `).join('');

    insightsContainer.innerHTML = `
      <div class="insights-header">
        <h3 class="insights-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="insights-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Key Insights
        </h3>
      </div>
      <div class="insight-list">
        ${insightsList}
      </div>
    `;
  }

  function showError(message) {
    // Implement error display
    console.error(message);
  }

  function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
  }

  function calculateAverageContractLength(contracts) {
    // Calculate average contract length in months
    // Implement calculation logic
    return 0;
  }
}); 