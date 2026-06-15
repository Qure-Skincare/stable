(() => {
	const inputSelector = 'input[type="radio"]:not([name="delivery-type"]), input[type="checkbox"]';
	const triggerSelector = [
		'.c-options-selector',
		'.c-supply-selector',
		'.c-payment-selector',
		'.c-subscribe-selector',
		'.e-pill-tabs'
	].join(',');

	const getDetails = (step) => step.querySelector('.info-items');

	const getTriggerScope = (step) => {
		const details = getDetails(step);
		let sibling = details?.previousElementSibling;

		while (sibling) {
			if (sibling.matches(triggerSelector)) return sibling;
			sibling = sibling.previousElementSibling;
		}

		return step;
	};

	const getTriggers = (step) =>
		[...getTriggerScope(step).querySelectorAll(inputSelector)]
			.filter((i) => !i.closest('.info-items'));

	const showDetails = (step, index = -1) => {
		const items = step.querySelectorAll('.info-items__item');

		items.forEach((item, i) => {
			item.classList.toggle('show', i === index);
		});
	};

	const syncStep = (step) => {
		const triggers = getTriggers(step);
		const checkedIndex = triggers.findIndex((i) => i.checked);
		showDetails(step, checkedIndex);
	};

	const resolveInput = (label) => {
		const nested = label.querySelector('input');
		if (nested) return nested;

		const id = label.getAttribute('for');
		return id ? document.getElementById(id) : null;
	};

	document.querySelectorAll('.treatment__step').forEach((step) => {

		step.addEventListener('change', (e) => {
			const input = e.target;
			if (!(input instanceof HTMLInputElement)) return;
			if (!['radio', 'checkbox'].includes(input.type)) return;
			if (input.closest('.info-items') || !input.checked) return;

			const index = getTriggers(step).indexOf(input);
			if (index !== -1) showDetails(step, index);
		});

		step.addEventListener('click', (e) => {
			const label = e.target.closest?.('label');
			if (!label || label.closest('.info-items')) return;

			const input = resolveInput(label);
			if (!input) return;

			queueMicrotask(() => syncStep(step));
		});

		syncStep(step);
	});
})();