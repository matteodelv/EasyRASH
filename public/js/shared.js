/*
 *	SHARED.JS
 *
 *	Authors:
 *	Matteo Del Vecchio
 *	Filippo Vigani
 */

/*
	Shared support functions
*/

const PANEL_TRANSITION_TIME = 200;
const UPDATE_ICON_PAPER_ACCEPTED = "PaperDecisionAccepted";
const UPDATE_ICON_PAPER_REJECTED = "PaperDecisionRejected";
const UPDATE_ICON_REVIEW_SENT = "ReviewSent";

function showErrorAlert(selector, message, timed) {
	var alertSelector = selector + ' .alert';

	if ($(alertSelector).hasClass('hidden')) {
		$(alertSelector).removeClass('hidden');
	}

	$(alertSelector).contents().filter(function() { return this.nodeType === 3 }).remove();
	$(alertSelector).append(message);

	$(alertSelector).show();
	
	if (timed) {
		window.setTimeout(function() {
			$(alertSelector).fadeIn(PANEL_TRANSITION_TIME).slideUp(500, function() {
				$(this).addClass('hidden'); 
			});
		}, 5000);
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
		delay: 5000,
		mouse_over: 'pause',
		z_index: 1051
	});
}
