document.addEventListener('DOMContentLoaded', function() {
    const list = document.querySelector('.machine-list');
    const sortSelect = document.getElementById('sort-select');
    const existingItems = Array.from(list.children);
    const existingCount = existingItems.length;
    
    // Store the original items for reference
    const originalItems = [...existingItems];
    
    // Function to sort items
    function sortItems(sortType) {
        // Remove all items temporarily
        while (list.firstChild) {
            list.removeChild(list.firstChild);
        }
        
        let itemsToSort;
        
        switch(sortType) {
            case 'recent':
                // Sort by most recent (assuming items are in chronological order)
                itemsToSort = [...originalItems].reverse();
                break;
            case 'random':
                // Random sort
                itemsToSort = [...originalItems].sort(() => Math.random() - 0.5);
                break;
            case 'original':
            default:
                // Original order
                itemsToSort = [...originalItems];
                break;
        }
        
        // Add the sorted items
        itemsToSort.forEach(item => list.appendChild(item.cloneNode(true)));
        
        // Add remaining items up to 10,000
        for (let i = existingCount + 1; i <= 10000; i++) {
            const li = document.createElement('li');
            li.textContent = 'Coming Soon';
            list.appendChild(li);
        }
    }
    
    // Add event listener for sort selection
    sortSelect.addEventListener('change', (e) => {
        sortItems(e.target.value);
    });
    
    // Initial sort (original order)
    sortItems('original');
    
    // Life expectancy countdown in modal
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
