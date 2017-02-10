var $pageContentWrapper;

$(document).ready(function() {
	sessionStorage.userRole = 'reader';
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
				completeTitle += (res[i].status === 'closed') ? ' [CLOSED]' : '';
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
							//History.pushState("", "EasyRash", "/");

							fetchAndBuildSidebarMenu(result, true, function() {
								loadCurrentPaperContent();
							});
						},
						error: function(err) {
							$.notify({
								message: JSON.parse(err.responseText).message,
								icon: "fa fa-exclamation-triangle"
							}, {
								type: "danger",
								delay: 3000,
								mouse_over: "pause"
							});
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
			$.notify({
				message: JSON.parse(err.responseText).message,
				icon: "fa fa-exclamation-triangle"
			}, {
				type: "danger",
				delay: 3000,
				mouse_over: "pause"
			});
		}
	});
}

function createNewConference() {
	var data = {};
	$('#newConfForm input[name]').each(function(index) {
		data[$(this).attr('name')] = $(this).val();
	});

	$.ajax({
		url: '/api/events/create',
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
			$('#newConfForm .modal-body .alert').empty();
			$('#newConfForm .modal-body').prepend($('<div class="alert alert-danger fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + JSON.parse(error.responseText).message + '</div>'));

			window.setTimeout(function() {
				$("#newConfForm .alert").fadeTo(500, 0).slideUp(500, function() {
					$(this).remove(); 
				});
			}, 2000);
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
			
				$("#page-content-wrapper #top .row").fadeTo(500, 0).slideUp(500, function() {
					$("#page-content-wrapper #top").empty();
					buildConfAdminPanel(res.conference);
				});
			},
			error: function(err) {
				$.notify({
					message: JSON.parse(err.responseText).message,
					icon: "fa fa-exclamation-triangle"
				}, {
					type: "danger",
					delay: 3000,
					mouse_over: "pause"
				});
			}
		});
	}
}

function buildConfAdminPanel(confData) {
	var panel = $('<div id="conf-admin-panel"><div class="row"><div class="panel-content col-md-8 col-md-offset-2"></div></div></div>');
	$('#page-content-wrapper #top').append(panel);

	var headTitle = $('<h4>Chair Admin Panel - </h4>').append(confData.conference);
	var headText = $('<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam feugiat turpis vel leo aliquam, id ultrices ligula sodales. Nam venenatis bibendum ipsum nec aliquam. Praesent ut rutrum lorem. Nulla nec odio dolor. Aenean varius magna ut pretium ornare. Phasellus sit amet gravida lacus. Curabitur lacinia lorem vestibulum velit lacinia venenatis. In finibus erat vitae dui tincidunt, sed vulputate justo commodo. Aliquam gravida vestibulum orci, volutpat maximus justo semper eget. Fusce a purus felis.</p>');

	var ids = ["confTitle", "confAcronym", "confCochairs", "confReviewers"];
	var texts = ["Title:", "Acronym:", "Co-Chairs:", "Reviewers:", "Update Conference", "Close Admin Panel"];
	var types = ["text", "text", "email", "email"];
	var names = ["title", "acronym", "cochairs", "reviewers"];

	var form = $('<form class="form-horizontal"></form>');

	var ccSelect = $('<select></select>');
	ccSelect.addClass('form-control');
	ccSelect.attr('multiple', 'multiple');
	ccSelect.attr('id', 'confCochairs');
	ccSelect.attr('name', 'cochairs');
	var rSelect = ccSelect.clone();
	rSelect.attr('id', 'confReviewers');
	rSelect.attr('name', 'reviewers');

	var dataSourceC = [];
	var dataSourceR = [];

	$.ajax({
		url: "/api/users/list",
		method: "GET",
		success: function(res) {
			res.forEach(user => {
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
				buttonWidth: '200px',
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
				buttonWidth: '200px',
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

			$(form).prepend('<div class="alert alert-warning fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + JSON.parse(err.responseText).message + ' Try again later...</div>');

			window.setTimeout(function() {
				$("#conf-admin-panel .alert").fadeTo(500, 0).slideUp(500, function() {
					$(this).remove(); 
				});
			}, 2000);
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
			$(input).attr('value', $i == 0 ? confData.conference : confData.acronym);
			$(input).attr('name', names[$i]);
			if (confData.status === "closed") $(input).attr('disabled', 'disabled');

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
		if ($i == 4 && confData.status === "closed") $(button).attr('disabled', 'disabled');

		$(group).append(button);
	}

	$('#conf-admin-panel .panel-content').append(headTitle).append(headText).append(form).append('<div id="closeConfDiv"></div>');

	var closeConfBtn = $('<button type="submit" class="btn btn-danger btn-lg pull-left"></button>');
	closeConfBtn.append('Close Conference');

	if (confData.status === "open") {
		if (confData.submissions.length === 0 || !confData.submissions.every(element => { return element.status === "accepted"; }))
			closeConfBtn.addClass('disabled');
	}
	else closeConfBtn.addClass('disabled');

	$('#closeConfDiv').append(closeConfBtn);

	var closeText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam feugiat turpis vel leo aliquam, id ultrices ligula sodales. Nam venenatis bibendum ipsum nec aliquam. Praesent ut rutrum lorem. Nulla nec odio dolor. Aenean varius magna ut pretium ornare. Phasellus sit amet gravida lacus.';
	$('#closeConfDiv').append('<p class="pull-right"></p>').append(closeText);

	$('#closeConfDiv .btn-danger').on('click', function(e) {
		e.preventDefault();

		$.ajax({
			url: encodeURI('/api/events/close/' + confData.acronym),
			method: 'PUT',
			success: function(result) {
				$(this).attr('disabled', 'disabled');
				$.notify({
					message: result.message,
					icon: "fa fa-check"
				}, {
					type: "success",
					delay: 3000,
					mouse_over: "pause"
				});

				$('#conf-admin-panel form *').filter(':input').each(function() {
					if (!$(this).hasClass('btn-default')) $(this).attr('disabled', 'disabled');
				});
			},
			error: function(error) {
				$.notify({
					message: JSON.parse(error.responseText).message,
					icon: "fa fa-exclamation-triangle"
				}, {
					type: "danger",
					delay: 3000,
					mouse_over: "pause"
				});
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
			url: encodeURI('/api/events/update/' + confData.acronym),
			success: function(res) {
				$(form).prepend('<div class="alert alert-success fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + res.message + '</div>');

				getConferences();

				window.setTimeout(function() {
					$("#conf-admin-panel .alert").fadeTo(500, 0).slideUp(500, function() {
						$(this).remove(); 
					});
				}, 2000);
			},
			error: function(err) {
				$(form).prepend('<div class="alert alert-warning fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + JSON.parse(err.responseText).message + '</div>');

				window.setTimeout(function() {
					$("#conf-admin-panel .alert").fadeTo(500, 0).slideUp(500, function() {
						$(this).remove(); 
					});
				}, 2000);
			}
		});
	});

	$('#conf-admin-panel form .form-group').last().find('.btn-default').on('click', function(e) {
		e.preventDefault();

		// Remove admin panel and restore "your paper will appear here" or paper
		$("#conf-admin-panel").fadeTo(500, 0).slideUp(500, function() {
			$(this).remove();
			$('#page-content-wrapper #top').html($pageContentWrapper);
		});
	});
}

function showAssignReviewersModal() {
	if ($('#paper-container').children().length === 0) {
		$.notify({
			message: "You have to select a paper before assigning reviewers to it!",
			icon: "fa fa-exclamation-triangle"
		}, {
			type: "danger",
			delay: 3000,
			mouse_over: "pause"
		});
	} else {
		$('#reviewersSelector').multiselect({
			disableIfEmpty: true,
			maxHeight: 180,
			buttonWidth: '200px',
			nonSelectedText: 'Choose...',
			numberDisplayed: 0,
			enableFiltering: true
		});
		var paperID = document.location.pathname.split('papers/').pop().replace('/','');
		$.ajax({
			url: encodeURI('/api/events/' + sessionStorage.currentAcronym + '/reviewers/' + paperID),
			method: 'GET',
			success: function(result) {
				var dataSource = [];
				result.forEach(rev => {
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
		url: encodeURI('/api/events/' + sessionStorage.currentAcronym + '/reviewers/' + paperID),
		data: data,
		success: function(result) {
			$('#assignReviewersModal').modal('hide');
			$.notify({
				message: result.message,
				icon: "fa fa-check"
			}, {
				type: 'success',
				delay: 3000,
				mouse_over: "pause",
				z_index: 1051
			});
		},
		error: function(error) {
			$('#assignRevSubmit').animateCss('shake');
			$('#assignRevForm .help-inline').animateCss('bounceIn').text(JSON.parse(error.responseText).message);
		}
	});
}

function checkCurrentRole() {
	if (sessionStorage.userRole && sessionStorage.userRole === 'Chair') {
		$('.admin-conference-btn').removeClass('hidden').animateCss('fadeIn');
		$('.admin-reviewers-btn').removeClass('hidden').animateCss('fadeIn');

		$('.admin-conference-btn').on("click", function() {
			showConferenceAdminPanel(sessionStorage.currentAcronym);
		});
		$('.admin-reviewers-btn').on("click", function() {
			showAssignReviewersModal();
		});
	}
	else {
		$('.admin-conference-btn').addClass('hidden');
		$('.admin-conference-btn').off('click');
		$('.admin-reviewers-btn').addClass('hidden');
		$('.admin-reviewers-btn').off('click');
	}
}