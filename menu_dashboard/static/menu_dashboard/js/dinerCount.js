document.addEventListener('DOMContentLoaded', function() {
    // Hide menu content initially
    const menuContent = document.getElementById('menuContent');
    if (menuContent) {
        menuContent.style.display = 'none';
    }

    const tableInfoModal = new bootstrap.Modal(document.getElementById('tableInfoModal'), {
        backdrop: 'static',
        keyboard: false
    });
    
    const dinerCountGrid = document.getElementById('dinerCountGrid');
    const tableInfoForm = document.getElementById('tableInfoForm');
    let selectedCount = 0;

    // Check if user has already selected guest count
    const hasSelectedGuests = localStorage.getItem('hasSelectedGuests');
    const guestCount = localStorage.getItem('guestCount');

    if (hasSelectedGuests && guestCount) {
        // If user has already selected, show menu directly
        if (menuContent) {
            menuContent.style.display = 'block';
            menuContent.classList.add('visible');
        }
        return; // Exit early, don't show modal
    }

    // Create number buttons
    for (let i = 1; i <= 12; i++) {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <input type="radio" class="btn-check" name="dinerCount" id="diner${i}" value="${i}" autocomplete="off">
            <label class="btn w-100 py-3" style="border: 2px solid #ef8c31; color: #ef8c31; border-radius: 12px; background-color: white; cursor: pointer;" for="diner${i}">
                ${i}
            </label>
        `;
        dinerCountGrid.appendChild(col);
    }

    // Handle form submission
    tableInfoForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (selectedCount > 0) {
            const submitButton = tableInfoForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2"></span>
                <span class="text-white">Processing...</span>
            `;
            
            // Store guest count and set flag
            localStorage.setItem('guestCount', selectedCount);
            localStorage.setItem('hasSelectedGuests', 'true');
            
            setTimeout(() => {
                tableInfoModal.hide();
                // Show menu with fade effect
                if (menuContent) {
                    menuContent.style.display = 'block';
                    menuContent.classList.add('visible');
                }
            }, 800);
        }
    });

    // Handle button selection
    dinerCountGrid.addEventListener('change', function(e) {
        if (e.target.type === 'radio') {
            selectedCount = parseInt(e.target.value);
            
            // Add animation to the selected button
            const label = document.querySelector(`label[for="${e.target.id}"]`);
            label.classList.add('selected-animate');
            setTimeout(() => label.classList.remove('selected-animate'), 300);
        }
    });

    // Show the modal only if user hasn't selected guests before
    // if (!hasSelectedGuests) {
    //     tableInfoModal.show();
    // }
});

// Add this CSS for the fade effect
const style = document.createElement('style');
style.textContent = `
    #menuContent {
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    }
    #menuContent.visible {
        opacity: 1;
    }
    .selected-animate {
        transform: scale(0.95);
        transition: transform 0.3s ease;
    }
`;
document.head.appendChild(style);