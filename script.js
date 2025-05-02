document.addEventListener('DOMContentLoaded', function() {
    const list = document.querySelector('.machine-list');
    const existingItems = Array.from(list.children);
    const existingCount = existingItems.length;
    
    // Remove existing items temporarily
    existingItems.forEach(item => item.remove());
    
    // Add items up to 10,000, preserving existing ones
    for (let i = 1; i <= 10000; i++) {
        const li = document.createElement('li');
        if (i <= existingCount) {
            // Restore the original item
            li.innerHTML = existingItems[i-1].innerHTML;
        } else {
            li.textContent = 'Coming Soon';
        }
        list.appendChild(li);
    }

    // Calculate days remaining until target date
    const daysLeftElement = document.getElementById('days-left');
    const targetDate = new Date('2061-06-03'); // 60 days later than previous date

    function updateDaysLeft() {
        const now = new Date();
        const timeDiff = targetDate - now;
        const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        daysLeftElement.textContent = daysLeft.toLocaleString();
    }

    // Update immediately and then once per day
    updateDaysLeft();
    setInterval(updateDaysLeft, 24 * 60 * 60 * 1000);
});
