// Добавление плавной прокрутки к якорным ссылкам (если потребуется)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Логика для будущих интерактивных элементов
document.addEventListener('DOMContentLoaded', () => {
    console.log('Главная страница загружена, скрипты готовы к работе');
});
