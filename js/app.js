document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabIndicator = document.querySelector('.tab-indicator');

    function updateTabIndicator(activeTab) {
        if (!tabIndicator || !activeTab) return;
        const navRect = activeTab.parentElement.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        
        tabIndicator.style.width = `${tabRect.width}px`;
        tabIndicator.style.transform = `translateX(${tabRect.left - navRect.left}px)`;
    }

    // Initialize indicator position
    const initialActiveTab = document.querySelector('.tab-btn.active');
    updateTabIndicator(initialActiveTab);

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active classes
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content based on data-tab
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            const targetContent = document.getElementById(targetId);
            
            if (targetContent) {
                targetContent.classList.add('active');
            } else {
                // If content doesn't exist yet, we can handle it here
                console.log(`Content for ${targetId} not implemented yet`);
            }

            // Update indicator
            updateTabIndicator(tab);
        });
    });

    // Handle Window Resize for Indicator
    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            updateTabIndicator(activeTab);
        }
    });

    // Adjust Video Toggles
    const toggleBtns = document.querySelectorAll('.toggle-btn:not(.disabled)');
    toggleBtns.forEach(btn => {
        // Mock state based on UI image (e.g., Chapters, Subtitles, SponsorBlock active by default if they had badges, let's just make them togglable)
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
    });

    // URL Clear Button
    const urlInput = document.querySelector('.url-input');
    const clearBtn = document.querySelector('.clear-btn');
    
    if (clearBtn && urlInput) {
        clearBtn.addEventListener('click', () => {
            urlInput.value = '';
            urlInput.focus();
        });
    }

    // Floating Download Button
    const fabButton = document.querySelector('.floating-action-btn');
    if (fabButton) {
        fabButton.addEventListener('click', () => {
            const url = document.querySelector('.url-input').value;
            if (!url) {
                alert('Please enter a valid URL first!');
                return;
            }
            
            // Add a little downloading animation class
            fabButton.classList.remove('pulse');
            fabButton.innerHTML = '<i class="ri-loader-4-line ri-spin"></i>';
            fabButton.style.backgroundColor = 'var(--text-secondary)';
            
            // Mock download step
            setTimeout(() => {
                fabButton.innerHTML = '<i class="ri-check-line"></i>';
                fabButton.style.backgroundColor = '#10B981'; // Success Green
                
                setTimeout(() => {
                    fabButton.innerHTML = '<i class="ri-download-cloud-2-fill"></i>';
                    fabButton.style.backgroundColor = 'var(--accent-blue)';
                    fabButton.classList.add('pulse');
                }, 2000);
            }, 1500);
        });
    }
});
