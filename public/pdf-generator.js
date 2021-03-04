window.onload = function () {
    document.getElementById("download-btn")
        .addEventListener("click", () => {
            const invoice = this.document.getElementById("print-content");
            var opt = {
                margin: 1,
                filename: 'bill.pdf',
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            html2pdf().from(invoice).set(opt).save();
        })
}