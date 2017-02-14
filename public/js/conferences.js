var $pageContentWrapper;

function showErrorAlert(selector, message, timed) {
	var alertSelector = selector + ' .alert';
	if (!timed) $(alertSelector).addClass('hidden');
	
	$(alertSelector).text(message);
	$(alertSelector).removeClass('hidden');

	if (timed) {
		window.setTimeout(function() {
			$(alertSelector).fadeIn(PANEL_TRANSITION_TIME, function() {
				$(this).addClass('hidden');
			});
		}, 3000);
	}
}

$(document).ready(function() {
	sessionStorage.userRole = 'Reader';
	checkCurrentRole();
});

function getConferences() {
	$.ajax({
		url: "/api/events",
		method: "GET",
		success: function(res) {
			var conferencesUl = $("#conferenceSelector .dropdown-menu");
			conferencesUl.empty();

			for (var i = 0; i < res.length; i++) {
				var completeTitle = res[i].conference;
				completeTitle += (res[i].status === 'closed') ? ' <span class="error-message">[CLOSED]</span>' : '';
				var $li = $('<li><a>' + completeTitle + '</a></li>');
				$('a', $li).data('acronym', res[i].acronym);
				$('a', $li).on("click", function() {
					var a = $(this);
					$("#conferenceSelector .btn:first-child *:first-child").text($(this).text());
					$("#conferenceSelector .btn:first-child *:first-child").val($(this).text());

					$.ajax({
						url: encodeURI("/api/events/" + a.data('acronym') + "/papers"),
						method: "GET",
						success: function(result) {
							$("#sidebar-wrapper .profile-panel .userRole").text("Role: " + result.userRole);
							sessionStorage.userRole = result.userRole;
							sessionStorage.currentAcronym = result.acronym;

							checkCurrentRole();

							if ($('#paper-container').children().length !== 0) {
								History.pushState({}, '', "/");
								document.title = 'EasyRASH Web App';
								$(this).empty();
								$('#top ul.nav').empty();
								$('#placeholder p').text('Selected Conference: ' + sessionStorage.currentAcronym);
								$('#placeholder').removeClass('hidden');
								$(window).scrollTop(0);
							}
							else $('#placeholder p').text('Selected Conference: ' + sessionStorage.currentAcronym);

							fetchAndBuildSidebarMenu(result, true, function() {
								loadCurrentPaperContent();
							});
						},
						error: function(err) {
							showNotify(JSON.parse(err.responseText).message, true);
						}
					});
				});
				conferencesUl.append($li);
			}
			var $divider = $("<li class='divider'></li>");
			conferencesUl.append($divider);
			var $newConfButton = $('<li><a>New Conference...</a></li>');
			$('a', $newConfButton).on("click", function() {
				$('#newConfModal').modal('show');
			});
			conferencesUl.append($newConfButton);
		},
		error: function(err) {
			showNotify(JSON.parse(err.responseText).message, true);
		}
	});
}

function createNewConference() {
	var data = {};
	$('#newConfForm input[name]').each(function(index) {
		data[$(this).attr('name')] = $(this).val();
	});

	$.ajax({
		url: '/api/events/',
		method: 'POST',
		data: data,
		success: function(result) {
			$('#newConfForm .modal-body .alert').empty();
			$('#newConfForm .modal-body').prepend($('<div class="alert alert-success fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + result.message + '</div>'));
			
			getConferences();

			window.setTimeout(function() {
				$('#newConfModal').modal('hide');
			}, 1500);

			showConferenceAdminPanel(data.acronym);
		},
		error: function(error) {
			showErrorAlert('#newConfForm .modal-body', JSON.parse(error.responseText).message, true);
		}
	});
}

function showConferenceAdminPanel(acronym) {
	if ($('#conf-admin-panel').length === 0) {
		$.ajax({
			method: 'GET',
			url: encodeURI('/api/events/' + acronym),
			success: function(res) {
				$pageContentWrapper = $('#page-content-wrapper #top').html();
			
				$("#page-content-wrapper #top .row").fadeIn(PANEL_TRANSITION_TIME, function() {
					$("#page-content-wrapper #top").empty();
					buildConfAdminPanel(res.conference);
				});
			},
			error: function(err) {
				showNotify(JSON.parse(err.responseText).message, true);
			}
		});
	}
}

function buildConfAdminPanel(confData) {
	var panel = $('<div id="conf-admin-panel"><div class="row"><div class="panel-content col-md-8 col-md-offset-2"></div></div></div>');
	$('#page-content-wrapper #top').append(panel);

	var headTitle = $('<h4>Chair Admin Panel - </h4>').append(confData.conference);
	var headText = $('<p>As Chair, here you can manage the selected conference. You can update its name and its acronym and it\'s where Co-Chairs and Reviewers can be chosen. It\'s always useful to have Co-Chairs to avoid unwanted conflict of interest situations.</p><p class="text-info">Note: Once chosen, Reviewers can\'t be removed from their role.</p>');

	var ids = ["confTitle", "confAcronym", "confCochairs", "confReviewers"];
	var texts = ["Title:", "Acronym:", "Co-Chairs:", "Reviewers:", "Update Conference", "Close Admin Panel"];
	var types = ["text", "text", "email", "email"];
	var names = ["title", "acronym", "cochairs", "reviewers"];

	var form = $('<form class="form-horizontal"></form>');
	form.append('<div class="alert alert-danger fade in hidden" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a></div>');

	var ccSelect = $('<select></select>');
	ccSelect.addClass('form-control');
	ccSelect.prop('multiple', true);
	ccSelect.attr('id', 'confCochairs');
	ccSelect.attr('name', 'cochairs');
	var rSelect = ccSelect.clone();
	rSelect.attr('id', 'confReviewers');
	rSelect.attr('name', 'reviewers');

	var dataSourceC = [];
	var dataSourceR = [];

	$.ajax({
		url: "/api/users/",
		method: "GET",
		success: function(res) {
			res.forEach(function(user) {
				if (user) {
					var u = {
						value: user.id,
						label: user.family_name + ' ' + user.given_name + ' <' + user.email + '>'
					};

					if (confData.chairs.indexOf(user.id) === -1 && confData.pc_members.indexOf(user.id) === -1) {
						dataSourceC.push(u);
						dataSourceR.push(u);
					}
					else if (confData.chairs.indexOf(user.id) > -1) {
						u.selected = 'selected';
						if (user.id !== sessionStorage.userID)
							dataSourceC.push(u);
					}
					else {
						u.selected = 'selected';
						u.disabled = 'disabled';
						dataSourceR.push(u);
					}
				}
			});

			ccSelect.add(rSelect).multiselect({
				disableIfEmpty: true,
				maxHeight: 180,
				buttonWidth: '100%',
				nonSelectedText: 'Choose...',
				numberDisplayed: 0,
				enableFiltering: true,
				onChange: function(option, checked, select) {
					// Making multiselects mutually exclusive
					var selectID = $(option).closest('select').attr('id');
					var otherSelect = (selectID === 'confCochairs') ? $('#confReviewers') : $('#confCochairs');
					if (checked) {
						var otherCheckbox = $(otherSelect).find('[value="'+$(option).val()+'"]');
						if (!$(otherCheckbox).is(':disabled'))
							$(otherSelect).multiselect('deselect', $(option).val());
					}
				}
			});

			$(ccSelect).multiselect('dataprovider', dataSourceC);
			$(rSelect).multiselect('dataprovider', dataSourceR);

			if (confData.status === "closed") {
				$(ccSelect).multiselect('disable');
				$(rSelect).multiselect('disable');
			}
		},
		error: function(err) {
			ccSelect.add(rSelect).multiselect({
				disableIfEmpty: true,
				maxHeight: 180,
				buttonWidth: '100%',
				nonSelectedText: 'Choose...',
				numberDisplayed: 0,
				enableFiltering: true,
				onChange: function(option, checked, select) {
					// Making multiselects mutually exclusive
					var selectID = $(option).closest('select').attr('id');
					var otherSelect = (selectID === 'confCochairs') ? $('#confReviewers') : $('#confCochairs');
					if (checked) {
						var otherCheckbox = $(otherSelect).find('[value="'+$(option).val()+'"]');
						if (!$(otherCheckbox).is(':disabled'))
							$(otherSelect).multiselect('deselect', $(option).val());
					}
				}
			});

			showErrorAlert('#conf-admin-panel form', JSON.parse(err.responseText).message, true);
		}
	});

	for (var $i = 0; $i < 4; $i++) {
		var formGroup = $('<div class="form-group"></div>');
		$(formGroup).empty();

		var label = $('<label class="control-label col-sm-3"></label>');
		$(label).attr('for', ids[$i]);
		$(label).text(texts[$i]);
		$(formGroup).append(label);

		var div = $('<div class="col-sm-7"></div>');
		$(formGroup).append(div);

		if ($i < 2) {
			var input = $('<input class="form-control">');
			$(input).attr('type', types[$i]);
			$(input).attr('id', ids[$i]);
			$(input).prop('value', $i == 0 ? confData.conference : confData.acronym);
			$(input).attr('name', names[$i]);
			if (confData.status === "closed") $(input).prop('disabled', true);

			$(div).append(input);
		}
		else {
			if ($i == 2) $(div).append(ccSelect);
			else $(div).append(rSelect);
		}

		$(form).append(formGroup);
	}

	var formGroup = $('<div class="form-group"></div>');
	var group = $('<div class="col-sm-offset-3 col-sm-7"></div>');
	$(formGroup).append(group);
	$(form).append(formGroup);
	
	for (var $i = 4; $i < 6; $i++) {
		var button = $('<button type="submit"></button>');
		$(button).empty();

		$(button).append(texts[$i]);
		$(button).addClass($i == 4 ? 'btn btn-primary' : 'btn btn-default');
		if ($i == 5) $(button).addClass('pull-right');
		if ($i == 4 && confData.status === "closed") $(button).prop('disabled', true);

		$(group).append(button);
	}

	$('#conf-admin-panel .panel-content').append(headTitle).append(headText).append(form).append('<div id="closeConfDiv"></div>');

	var closeConfBtn = $('<button type="submit" class="btn btn-danger btn-lg pull-left"></button>');
	closeConfBtn.append('Close Conference');

	if (confData.status === "open") {
		if (confData.submissions.length === 0 || !confData.submissions.every(function(element) { return element.status !== "pending"; }))
			closeConfBtn.prop('disabled', true);
	}
	else closeConfBtn.prop('disabled', true);

	$('#closeConfDiv').append(closeConfBtn);

	var closeText = 'A conference can be closed only if all of the following conditions are met: it has to be open, has to contain at least one paper and each paper has to be reviewed by all its Reviewers and judged by one of the Chairs.';
	$('#closeConfDiv').append('<p class="pull-right"></p>').append(closeText);

	$('#closeConfDiv .btn-danger').on('click', function(e) {
		e.preventDefault();

		$.ajax({
			url: encodeURI('/api/events/' + confData.acronym + '/close'),
			method: 'PUT',
			success: function(result) {
				$(this).prop('disabled', true);
				showNotify(result.message, false);

				$('#conf-admin-panel form *').filter(':input').each(function() {
					if (!$(this).hasClass('btn-default')) $(this).prop('disabled', true);
				});
			},
			error: function(error) {
				showNotify(JSON.parse(error.responseText).message, true);
			}
		});
	});

	$('#conf-admin-panel form .form-group').last().find('.btn-primary').on('click', function(e) {
		e.preventDefault();

		var data = {		// confData.acronym serve ancora?
			oldAcronym: confData.acronym
		};
		$('#conf-admin-panel input[name], #conf-admin-panel select[name]').each(function(index) {
			data[$(this).attr('name')] = $(this).val();

			var curName = $(this).attr('name');
			if (curName === 'cochairs' || curName === 'reviewers') {
				if (data[curName] && data[curName][0] === 'notset') data[curName] = data[curName].slice(1, data[curName].length);
			}
		});
		if (!data['cochairs']) delete data['cochairs'];
		if (!data['reviewers']) delete data['reviewers'];

		$.ajax({
			method:'PUT',
			data: data,
			url: encodeURI('/api/events/' + confData.acronym),
			success: function(res) {
				showNotify(res.message, false);

				getConferences();

				$("#conf-admin-panel").fadeOut(PANEL_TRANSITION_TIME, function() {
					$(this).remove();
					$('#page-content-wrapper #top').html($pageContentWrapper);
				});
			},
			error: function(err) {
				showErrorAlert('#conf-admin-panel form', JSON.parse(err.responseText).message, true);
			}
		});
	});

	$('#conf-admin-panel form .form-group').last().find('.btn-default').on('click', function(e) {
		e.preventDefault();

		// Remove admin panel and restore "your paper will appear here" or paper
		$("#conf-admin-panel").fadeOut(PANEL_TRANSITION_TIME, function() {
			$(this).remove();
			$('#page-content-wrapper #top').html($pageContentWrapper);
		});
	});
}

function showAssignReviewersModal() {
	if ($('#paper-container').children().length === 0) {
		showNotify('You have to select a paper before assigning reviewers to it!', true);
	} else {
		$('#reviewersSelector').multiselect({
			disableIfEmpty: true,
			maxHeight: 180,
			buttonWidth: '100%',
			nonSelectedText: 'Choose...',
			numberDisplayed: 0,
			enableFiltering: true
		});
		var paperID = document.location.pathname.split('papers/').pop().replace('/','');
		$.ajax({
			url: encodeURI('/api/events/' + sessionStorage.currentAcronym + '/' + paperID + '/reviewers'),
			method: 'GET',
			success: function(result) {
				var dataSource = [];
				result.forEach(function(rev) {
					if (rev) dataSource.push({
						value: rev.id,
						label: rev.family_name + ' ' + rev.given_name + ' <' + rev.email + '>',
						selected: rev.alreadyReviewer,
						disabled: rev.alreadyReviewer
					});
				});
				$('#reviewersSelector').multiselect('dataprovider', dataSource);
			},
			error: function(error) {
				console.log("Error reviewers");
			}
		});
		$('#assignReviewersModal').modal('show');
	}
}

function assignReviewersToPaper() {
	var selected = $('#reviewersSelector').val();
	var paperID = document.location.pathname.split('papers/').pop().replace('/','');
	var data = {
		revs: selected
	};
	$.ajax({
		method: 'POST',
		url: encodeURI('/api/events/' + sessionStorage.currentAcronym + '/' + paperID + '/reviewers'),
		data: data,
		success: function(result) {
			$('#assignReviewersModal').modal('hide');
			showNotify(result.message, false);
		},
		error: function(error) {
			$('#assignRevSubmit').animateCss('shake');
			showErrorAlert('#assignRevForm .modal-body', JSON.parse(error.responseText).message, true);
		}
	});
}

function showPaperDecisionModal() {
	if ($('#paper-container').children().length === 0) {
		showNotify('You have to select a paper before accepting or rejecting it!', true);
	} else {
		var paperID = document.location.pathname.split('papers/').pop().replace('/','');
		
		$.ajax({
			method: 'GET',
			url: encodeURI('/api/papers/' + paperID + '/reviews'),
			success: function(result) {
				// if (result.isAuthor) {
				// 	$('#adminPaperDecision .btn-primary').prop('disabled', true);
				// 	showErrorAlert('#reviewJudgementsForm .modal-body', 'You are not allowed to judge this paper because you are one of its Authors, even though you are Chair!', false);
				// }
				var pendingRevs = result.reviews.some(function(r) { return r.decision === 'pending' });
				$('#adminPaperDecision .btn-primary').prop('disabled', pendingRevs);
				if (pendingRevs)
					showErrorAlert('#reviewJudgementsForm .modal-body', 'Reviews for this paper have not been completed!', false);
				else $('#adminPaperDecision .modal-body .alert').addClass('hidden');

				$('#judgementsTable>tbody').empty();
				result.reviews.forEach(function(review) {
					var decisionTD = review.decision === 'accepted' ? '<i class="fa fa-check"></i> Accepted' : (review.decision === 'pending' ? '<i class="fa fa-exclamation-circle"></i> Pending' : '<i class="fa fa-times"></i> Rejected')
					var revRow = $('<tr><td><a href="mailto:' + review.reviewer.email + '">' + review.reviewer.fullName + '</a></td><td>' + decisionTD + '</tr></td>');
					$('#judgementsTable>tbody').append(revRow);
				});
			},
			error: function(error) {
				showNotify(JSON.parse(error.responseText).message, true);
			}
		});

		$('#adminPaperDecision').modal('show');
	}
}

function sendPaperDecision() {
	var decision = $("input[name=decisionradiochair]:checked").val();
	var paperID = document.location.pathname.split('papers/').pop().replace('/','');
	var data = {
		decision: decision
	};

	console.log(decision);

	//TODO: ajax call
	$.ajax({
		method: 'POST',
		url: encodeURI('/api/papers/' + paperID + '/judge'),
		data: data,
		success: function(result) {
			$('#adminPaperDecision').modal('hide');
			showNotify(result.message, false);
		},
		error: function(error) {
			showErrorAlert('#adminPaperDecision .modal-body', JSON.parse(error.responseText).message, true);
		}
	});
}

// TODO: Ricontrollare i controlli per i pulsanti e la modalità annotator ://
function checkCurrentRole() {
	if (sessionStorage.userRole && sessionStorage.userRole === 'Chair') {
		/*if (activeMode === 'reviewer') {
			
			updateModeCheckbox(false);

			$('.admin-conference-btn').addClass('hidden');
			$('.admin-conference-btn').off('click');
			$('.admin-reviewers-btn').addClass('hidden');
			$('.admin-reviewers-btn').off('click');
			$('.admin-paper-decision').addClass('hidden');
			$('.admin-paper-decision').off('click');
		}
		else {
			var userIsRev = JSON.parse(sessionStorage.revForPaper);
			if (!userIsRev) {*/
				if ($('.admin-conference-btn').hasClass('hidden')) $('.admin-conference-btn').removeClass('hidden').animateCss('fadeIn');
				if ($('.admin-reviewers-btn').hasClass('hidden')) $('.admin-reviewers-btn').removeClass('hidden').animateCss('fadeIn');
				if ($('.admin-paper-decision').hasClass('hidden')) $('.admin-paper-decision').removeClass('hidden').animateCss('fadeIn');

				$('.admin-conference-btn').off('click').on("click", function() {
					showConferenceAdminPanel(sessionStorage.currentAcronym);
				});
				$('.admin-reviewers-btn').off('click').on("click", function() {
					showAssignReviewersModal();
				});
				$('.admin-paper-decision').off('click').on('click', function() {
					showPaperDecisionModal();
				});
			/*}
		}*/
	}
	else {
		$('.admin-conference-btn').addClass('hidden');
		$('.admin-conference-btn').off('click');
		$('.admin-reviewers-btn').addClass('hidden');
		$('.admin-reviewers-btn').off('click');
		$('.admin-paper-decision').addClass('hidden');
		$('.admin-paper-decision').off('click');
	}
}