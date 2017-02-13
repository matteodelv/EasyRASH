/*
	Shared support functions
*/

function showErrorAlert(selector, message, timed) {
	var alertSelector = selector + ' .alert';
	if (!timed) $(alertSelector).addClass('hidden');
	
	$(alertSelector).text(message);
	$(alertSelector).removeClass('hidden');

	if (timed) {
		window.setTimeout(function() {
			$(alertSelector).fadeTo(500, 0).slideUp(500, function() {
				$(this).addClass('hidden'); 
			});
		}, 3000);
	}
}

function showNotify(message, isError) {
	var type = (isError) ? 'danger' : 'success';
	var icon = (isError) ? 'fa fa-exclamation-triangle' : 'fa fa-check';

	$.notify({
		message: message,
		icon: icon
	}, {
		type: type,
		delay: 3000,
		mouse_over: 'pause',
		z_index: 1051
	});
}
