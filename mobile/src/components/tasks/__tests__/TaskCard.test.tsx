import React from 'react';
import { Provider } from 'react-redux';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { store } from '../../../store';
import { makeTask } from '../../../test-utils/fixtures';
import { ThemeProvider } from '../../../theme';
import { TaskCard } from '../TaskCard';

const NOW = new Date(2026, 0, 10, 12, 0).getTime();

function render(ui: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <Provider store={store}>
        <ThemeProvider>{ui}</ThemeProvider>
      </Provider>,
    );
  });
  return renderer;
}

/** Every string rendered inside a host <Text>. */
const texts = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAll(node => (node.type as unknown) === 'Text')
    .flatMap(node => [node.props.children].flat())
    .filter((child): child is string => typeof child === 'string');

describe('<TaskCard />', () => {
  it('shows title, deadline status and the up-next badge', () => {
    const task = makeTask({
      title: 'Submit report',
      priority: 'high',
      category: 'work',
      tags: ['q1'],
      deadline: new Date(NOW - 2 * 3600_000).toISOString(),
    });
    const renderer = render(
      <TaskCard
        task={task}
        now={NOW}
        onPress={jest.fn()}
        onToggle={jest.fn()}
        upNext
      />,
    );
    const shown = texts(renderer);
    expect(shown).toEqual(
      expect.arrayContaining([
        'Submit report',
        '2h late',
        'Up next',
        'HI',
        'Work',
      ]),
    );
  });

  it('calls onToggle from the checkbox and onPress from the card', () => {
    const task = makeTask({ title: 'Walk the dog' });
    const onToggle = jest.fn();
    const onPress = jest.fn();
    const renderer = render(
      <TaskCard task={task} now={NOW} onPress={onPress} onToggle={onToggle} />,
    );

    const checkbox = renderer.root.find(
      node => node.props.accessibilityRole === 'checkbox' && node.props.onPress,
    );
    act(() => checkbox.props.onPress());
    expect(onToggle).toHaveBeenCalledWith(task);

    const card = renderer.root.find(
      node =>
        node.props.accessibilityLabel === 'Walk the dog' && node.props.onPress,
    );
    act(() => card.props.onPress());
    expect(onPress).toHaveBeenCalledWith(task);
  });
});
