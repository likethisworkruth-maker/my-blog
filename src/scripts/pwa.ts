if (import.meta.env.PROD && 'serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
			console.error('Service Workerの登録に失敗しました。', error);
		});
	});
}
