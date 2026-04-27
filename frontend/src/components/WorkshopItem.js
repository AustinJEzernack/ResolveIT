import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
const WorkshopItem = ({ id, name, description, memberCount }) => {
    const navigate = useNavigate();
    const handleClick = () => {
        navigate(`/workshop/${id}`);
    };
    return (_jsxs("div", { className: "workshop-item", onClick: handleClick, children: [_jsxs("div", { className: "workshop-info", children: [_jsx("h4", { className: "workshop-name", children: name }), _jsx("p", { className: "workshop-description", children: description })] }), _jsx("div", { className: "workshop-meta", children: _jsxs("span", { className: "member-count", children: ["\uD83D\uDC65 ", memberCount] }) })] }));
};
export default WorkshopItem;
