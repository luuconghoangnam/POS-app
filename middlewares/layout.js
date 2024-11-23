module.exports = (req, res, next) => {
    res.renderWithLayout = async (view, options) => {
        try {
            const html = await new Promise((resolve, reject) => {
                res.render(view, options, (err, html) => {
                    if (err) reject(err);
                    else resolve(html);
                });
            });
            res.render('layout', {
                title: options.title,
                body: html
            });
        } catch (err) {
            console.error(err);
            res.status(500).send('Có lỗi xảy ra khi load layout');
        }
    };
    next();
};