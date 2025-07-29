// Events Management Module
class EventsManager {
    constructor() {
        this.currentEvents = [];
        this.filteredEvents = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRealtimeListener();
        this.loadEvents();
    }

    setupEventListeners() {
        // Add event button
        document.getElementById('add-event-btn')?.addEventListener('click', () => {
            this.showAddEventModal();
        });

        // Add event form
        document.getElementById('add-event-form')?.addEventListener('submit', (e) => {
            this.handleAddEvent(e);
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });
    }

    setupRealtimeListener() {
        // Listen for real-time event updates
        this.unsubscribe = dbManager.listen('events', (events) => {
            this.currentEvents = events;
            this.renderEvents();
            AppEvents.emit('eventsUpdated', events);
        });
    }

    async loadEvents() {
        try {
            Utils.showLoading();
            this.currentEvents = await dbManager.getAll('events');
            this.renderEvents();
            Utils.hideLoading();
        } catch (error) {
            console.error('Error loading events:', error);
            Utils.showToast('Error loading events. Please refresh the page.', 'error');
            Utils.hideLoading();
        }
    }

    showAddEventModal() {
        const modal = document.getElementById('add-event-modal');
        const form = document.getElementById('add-event-form');
        
        // Reset form
        form.reset();
        
        // Set default date to today
        document.getElementById('event-date').value = Utils.formatDateForInput(new Date());
        
        // Show modal
        modal.classList.add('show');
        
        // Focus on name input
        setTimeout(() => {
            document.getElementById('event-name').focus();
        }, 100);
    }

    async handleAddEvent(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const eventData = {
            name: formData.get('name') || document.getElementById('event-name').value,
            date: formData.get('date') || document.getElementById('event-date').value,
            time: formData.get('time') || document.getElementById('event-time').value,
            location: formData.get('location') || document.getElementById('event-location').value,
            description: formData.get('description') || document.getElementById('event-description').value
        };

        // Validate required fields
        if (!eventData.name || !eventData.date) {
            Utils.showToast('Please enter event name and date.', 'error');
            return;
        }

        // Validate date is not in the past
        const eventDate = new Date(eventData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventDate < today) {
            Utils.showToast('Event date cannot be in the past.', 'error');
            return;
        }

        // Clean up data
        eventData.name = eventData.name.trim();
        eventData.location = eventData.location?.trim() || '';
        eventData.description = eventData.description?.trim() || '';
        eventData.time = eventData.time || '';

        try {
            Utils.showLoading();
            
            const eventId = await dbManager.addEvent(eventData);
            
            Utils.hideLoading();
            Utils.showToast('Event added successfully!', 'success');
            
            // Close modal
            this.closeModal(document.getElementById('add-event-modal'));
            
        } catch (error) {
            console.error('Error adding event:', error);
            Utils.hideLoading();
            Utils.showToast('Error adding event. Please try again.', 'error');
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
        }
    }

    renderEvents() {
        this.renderCalendar();
        this.renderUpcomingEvents();
    }

    renderCalendar() {
        const calendarContainer = document.getElementById('events-calendar');
        if (!calendarContainer) return;

        // Simple calendar implementation
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Get events for current month
        const monthEvents = this.currentEvents.filter(event => {
            const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
            return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
        });

        calendarContainer.innerHTML = `
            <div class="calendar-header">
                <h3>${this.getMonthName(currentMonth)} ${currentYear}</h3>
                <div class="calendar-legend">
                    <span class="legend-item">
                        <span class="legend-color event-day"></span>
                        Events scheduled
                    </span>
                </div>
            </div>
            <div class="calendar-grid">
                ${this.generateCalendarGrid(currentYear, currentMonth, monthEvents)}
            </div>
        `;
    }

    generateCalendarGrid(year, month, events) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = '<div class="calendar-days">';
        
        // Day headers
        days.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Calendar days
        const currentDate = new Date(startDate);
        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = currentDate.getMonth() === month;
                const isToday = this.isSameDay(currentDate, new Date());
                const dayEvents = events.filter(event => {
                    const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
                    return this.isSameDay(eventDate, currentDate);
                });
                
                const classes = ['calendar-day'];
                if (!isCurrentMonth) classes.push('other-month');
                if (isToday) classes.push('today');
                if (dayEvents.length > 0) classes.push('has-events');
                
                html += `
                    <div class="${classes.join(' ')}" data-date="${currentDate.toISOString().split('T')[0]}">
                        <span class="day-number">${currentDate.getDate()}</span>
                        ${dayEvents.length > 0 ? `<div class="event-indicators">${dayEvents.map(e => `<div class="event-dot" title="${Utils.escapeHtml(e.name)}"></div>`).join('')}</div>` : ''}
                    </div>
                `;
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
        
        html += '</div>';
        return html;
    }

    renderUpcomingEvents() {
        const container = document.getElementById('upcoming-events');
        if (!container) return;

        // Get upcoming events (next 30 days)
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        
        const upcomingEvents = this.currentEvents.filter(event => {
            const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
            return eventDate >= today && eventDate <= futureDate;
        }).sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateA - dateB;
        });

        if (upcomingEvents.length === 0) {
            container.innerHTML = '<p class="text-center">No upcoming events in the next 30 days.</p>';
            return;
        }

        container.innerHTML = upcomingEvents.map(event => {
            const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
            const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
            
            return `
                <div class="event-card" onclick="eventsManager.viewEventDetails('${event.id}')">
                    <div class="event-date">
                        ${Utils.formatDate(eventDate)}
                        ${event.time ? `<span class="event-time">${event.time}</span>` : ''}
                        <span class="days-until">${daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}</span>
                    </div>
                    <div class="event-title">${Utils.escapeHtml(event.name)}</div>
                    <div class="event-details">
                        ${event.location ? `<div><i class="fas fa-map-marker-alt"></i> ${Utils.escapeHtml(event.location)}</div>` : ''}
                        ${event.description ? `<div class="event-description">${Utils.escapeHtml(event.description)}</div>` : ''}
                        <div class="event-stats">
                            <span><i class="fas fa-shopping-cart"></i> ${event.salesCount || 0} sales</span>
                            <span><i class="fas fa-dollar-sign"></i> ${Utils.formatCurrency(event.totalRevenue || 0)}</span>
                        </div>
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-sm btn-edit" onclick="event.stopPropagation(); eventsManager.editEvent('${event.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-delete" onclick="event.stopPropagation(); eventsManager.deleteEvent('${event.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async viewEventDetails(eventId) {
        try {
            const event = await dbManager.read('events', eventId);
            if (!event) {
                Utils.showToast('Event not found.', 'error');
                return;
            }

            // Get event sales
            const eventSales = await dbManager.query('sales', [
                { field: 'eventId', operator: '==', value: eventId }
            ]);

            this.showEventDetailsModal(event, eventSales);
        } catch (error) {
            console.error('Error loading event details:', error);
            Utils.showToast('Error loading event details.', 'error');
        }
    }

    showEventDetailsModal(event, sales) {
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        const totalRevenue = sales.reduce((sum, sale) => sum + sale.salePrice, 0);
        const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || Utils.calculateProfit(sale.salePrice, sale.purchasePrice)), 0);
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Event Details - ${Utils.escapeHtml(event.name)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <div class="event-details-grid">
                        <div class="detail-section">
                            <h4>Event Information</h4>
                            <div class="detail-item">
                                <strong>Name:</strong> ${Utils.escapeHtml(event.name)}
                            </div>
                            <div class="detail-item">
                                <strong>Date:</strong> ${Utils.formatDate(eventDate)}
                            </div>
                            <div class="detail-item">
                                <strong>Time:</strong> ${event.time || 'Not specified'}
                            </div>
                            <div class="detail-item">
                                <strong>Location:</strong> ${event.location || 'Not specified'}
                            </div>
                            <div class="detail-item">
                                <strong>Description:</strong> ${event.description || 'No description'}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Sales Performance</h4>
                            <div class="detail-item">
                                <strong>Total Sales:</strong> ${sales.length}
                            </div>
                            <div class="detail-item">
                                <strong>Total Revenue:</strong> ${Utils.formatCurrency(totalRevenue)}
                            </div>
                            <div class="detail-item">
                                <strong>Total Profit:</strong> ${Utils.formatCurrency(totalProfit)}
                            </div>
                            <div class="detail-item">
                                <strong>Average Sale:</strong> ${sales.length > 0 ? Utils.formatCurrency(totalRevenue / sales.length) : 'N/A'}
                            </div>
                        </div>
                    </div>
                    
                    ${sales.length > 0 ? `
                        <div class="event-sales">
                            <h4>Sales at This Event</h4>
                            <div class="sales-list">
                                ${sales.slice(0, 10).map(sale => {
                                    const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
                                    const profit = sale.profit || Utils.calculateProfit(sale.salePrice, sale.purchasePrice);
                                    return `
                                        <div class="sale-item">
                                            <div class="sale-info">
                                                <strong>${sale.productId}</strong>
                                                <span class="sale-customer">${Utils.escapeHtml(sale.customerName)}</span>
                                            </div>
                                            <div class="sale-details">
                                                <span>Seller: ${sale.seller}</span>
                                                <span class="sale-price">${Utils.formatCurrency(sale.salePrice)}</span>
                                                <span class="sale-profit ${profit >= 0 ? 'positive' : 'negative'}">${Utils.formatCurrency(profit)}</span>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                                ${sales.length > 10 ? `<div class="sale-item more-items">... and ${sales.length - 10} more sales</div>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="form-actions">
                        <button class="btn btn-secondary" onclick="eventsManager.editEvent('${event.id}'); this.closest('.modal').remove();">Edit Event</button>
                        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async editEvent(eventId) {
        try {
            const event = await dbManager.read('events', eventId);
            if (!event) {
                Utils.showToast('Event not found.', 'error');
                return;
            }

            this.showEditEventModal(event);
        } catch (error) {
            console.error('Error loading event for edit:', error);
            Utils.showToast('Error loading event details.', 'error');
        }
    }

    showEditEventModal(event) {
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Edit Event</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-form">
                    <form id="edit-event-form">
                        <div class="form-group">
                            <label for="edit-event-name">Event Name *</label>
                            <input type="text" id="edit-event-name" value="${Utils.escapeHtml(event.name)}" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="edit-event-date">Date *</label>
                                <input type="date" id="edit-event-date" value="${Utils.formatDateForInput(eventDate)}" required>
                            </div>
                            <div class="form-group">
                                <label for="edit-event-time">Time</label>
                                <input type="time" id="edit-event-time" value="${event.time || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="edit-event-location">Location</label>
                            <input type="text" id="edit-event-location" value="${event.location || ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit-event-description">Description</label>
                            <textarea id="edit-event-description" rows="3">${event.description || ''}</textarea>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                            <button type="submit" class="btn btn-primary">Update Event</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on name input
        setTimeout(() => {
            document.getElementById('edit-event-name').focus();
        }, 100);
        
        // Handle form submission
        const form = modal.querySelector('#edit-event-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditEvent(event.id, modal);
        });
        
        // Handle modal close
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async handleEditEvent(eventId, modal) {
        try {
            const eventData = {
                name: document.getElementById('edit-event-name').value.trim(),
                date: new Date(document.getElementById('edit-event-date').value),
                time: document.getElementById('edit-event-time').value,
                location: document.getElementById('edit-event-location').value.trim(),
                description: document.getElementById('edit-event-description').value.trim()
            };

            // Validate required fields
            if (!eventData.name || !eventData.date) {
                Utils.showToast('Please enter event name and date.', 'error');
                return;
            }

            Utils.showLoading();
            
            await dbManager.update('events', eventId, eventData);
            
            Utils.hideLoading();
            Utils.showToast('Event updated successfully!', 'success');
            
            // Close modal
            document.body.removeChild(modal);
            
        } catch (error) {
            console.error('Error updating event:', error);
            Utils.hideLoading();
            Utils.showToast('Error updating event. Please try again.', 'error');
        }
    }

    async deleteEvent(eventId) {
        if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
            try {
                Utils.showLoading();
                
                await dbManager.delete('events', eventId);
                
                Utils.hideLoading();
                Utils.showToast('Event deleted successfully!', 'success');
                
            } catch (error) {
                console.error('Error deleting event:', error);
                Utils.hideLoading();
                Utils.showToast('Error deleting event.', 'error');
            }
        }
    }

    // Utility methods
    getMonthName(month) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[month];
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    // Get event statistics
    getEventStats() {
        const now = new Date();
        const upcoming = this.currentEvents.filter(event => {
            const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
            return eventDate >= now;
        }).length;
        
        const past = this.currentEvents.length - upcoming;
        const totalRevenue = this.currentEvents.reduce((sum, event) => sum + (event.totalRevenue || 0), 0);
        
        return {
            total: this.currentEvents.length,
            upcoming,
            past,
            totalRevenue
        };
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}

// Add Events specific styles
const eventsStyles = `
    .calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e1e5e9;
    }
    
    .calendar-header h3 {
        margin: 0;
        color: #667eea;
    }
    
    .calendar-legend {
        display: flex;
        gap: 15px;
        font-size: 12px;
    }
    
    .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }
    
    .legend-color.event-day {
        background: #667eea;
    }
    
    .calendar-grid {
        background: white;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .calendar-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
    }
    
    .calendar-day-header {
        padding: 10px;
        background: #667eea;
        color: white;
        text-align: center;
        font-weight: 600;
        font-size: 12px;
    }
    
    .calendar-day {
        min-height: 60px;
        padding: 8px;
        border-bottom: 1px solid #e1e5e9;
        border-right: 1px solid #e1e5e9;
        position: relative;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }
    
    .calendar-day:hover {
        background: #f8f9fa;
    }
    
    .calendar-day:nth-child(7n) {
        border-right: none;
    }
    
    .calendar-day.other-month {
        color: #ccc;
        background: #f8f9fa;
    }
    
    .calendar-day.today {
        background: #fff3cd;
        border: 2px solid #ffc107;
    }
    
    .calendar-day.has-events {
        background: #e3f2fd;
    }
    
    .day-number {
        font-weight: 600;
        font-size: 14px;
    }
    
    .event-indicators {
        position: absolute;
        bottom: 4px;
        left: 4px;
        right: 4px;
        display: flex;
        gap: 2px;
        flex-wrap: wrap;
    }
    
    .event-dot {
        width: 6px;
        height: 6px;
        background: #667eea;
        border-radius: 50%;
    }
    
    .event-card {
        background: white;
        border-radius: 15px;
        padding: 20px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        border-left: 5px solid #667eea;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
    }
    
    .event-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
    }
    
    .event-date {
        color: #667eea;
        font-weight: 600;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .event-time {
        background: #667eea;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
    }
    
    .days-until {
        background: #28a745;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        margin-left: auto;
    }
    
    .event-title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin-bottom: 10px;
    }
    
    .event-details {
        color: #666;
        font-size: 14px;
        margin-bottom: 15px;
    }
    
    .event-description {
        margin-top: 8px;
        font-style: italic;
    }
    
    .event-stats {
        display: flex;
        gap: 15px;
        margin-top: 10px;
        font-size: 12px;
        color: #28a745;
    }
    
    .event-stats span {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .event-actions {
        position: absolute;
        top: 15px;
        right: 15px;
        display: flex;
        gap: 5px;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    .event-card:hover .event-actions {
        opacity: 1;
    }
    
    .event-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .event-sales {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
    }
    
    .event-sales h4 {
        margin-bottom: 15px;
        color: #667eea;
        border-bottom: 2px solid #e1e5e9;
        padding-bottom: 5px;
    }
    
    .sales-list {
        max-height: 300px;
        overflow-y: auto;
    }
    
    .sale-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        margin-bottom: 8px;
        background: white;
        border-radius: 5px;
        border-left: 3px solid #667eea;
    }
    
    .sale-item:last-child {
        margin-bottom: 0;
    }
    
    .sale-item.more-items {
        background: #e9ecef;
        color: #6c757d;
        font-style: italic;
        justify-content: center;
        border-left-color: #6c757d;
    }
    
    .sale-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    
    .sale-customer {
        font-size: 12px;
        color: #666;
    }
    
    .sale-details {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        font-size: 12px;
    }
    
    .sale-price {
        font-weight: 600;
        color: #28a745;
    }
    
    .sale-profit.positive {
        color: #28a745;
    }
    
    .sale-profit.negative {
        color: #dc3545;
    }
    
    @media (max-width: 768px) {
        .calendar-day {
            min-height: 40px;
            padding: 4px;
        }
        
        .day-number {
            font-size: 12px;
        }
        
        .event-indicators {
            bottom: 2px;
            left: 2px;
            right: 2px;
        }
        
        .event-dot {
            width: 4px;
            height: 4px;
        }
        
        .event-details-grid {
            grid-template-columns: 1fr;
        }
        
        .event-date {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .days-until {
            margin-left: 0;
        }
        
        .sale-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
        }
        
        .sale-details {
            align-items: flex-start;
        }
    }
`;

// Add styles to document
const eventsStyleSheet = document.createElement('style');
eventsStyleSheet.textContent = eventsStyles;
document.head.appendChild(eventsStyleSheet);

// Initialize events manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.eventsManager = new EventsManager();
});

// Listen for authentication events
AppEvents.on('userAuthenticated', () => {
    if (!window.eventsManager) {
        window.eventsManager = new EventsManager();
    }
});

AppEvents.on('userSignedOut', () => {
    if (window.eventsManager) {
        window.eventsManager.destroy();
        window.eventsManager = null;
    }
});